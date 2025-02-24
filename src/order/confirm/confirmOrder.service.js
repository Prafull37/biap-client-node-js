import { lookupBppById } from "../../utils/registryApis/index.js";
import { onOrderConfirm } from "../../utils/protocolApis/index.js";
import { JUSPAY_PAYMENT_STATUS, PAYMENT_TYPES, PROTOCOL_CONTEXT, PROTOCOL_PAYMENT, SUBSCRIBER_TYPE } from "../../utils/constants.js";
import { addOrUpdateOrderWithTransactionId, getOrderByTransactionId } from "../db/dbService.js";

import ContextFactory from "../../factories/ContextFactory.js";
import BppConfirmService from "./bppConfirm.service.js";
import JuspayService from "../../payment/juspay.service.js";

const bppConfirmService = new BppConfirmService();
const juspayService = new JuspayService();

class ConfirmOrderService {

    /**
     * 
     * @param {Array} items 
     * @returns Boolean
     */
    areMultipleBppItemsSelected(items) {
        return items ? [...new Set(items.map(item => item.bpp_id))].length > 1 : false;
    }

    /**
     * 
     * @param {Array} items 
     * @returns Boolean
     */
    areMultipleProviderItemsSelected(items) {
        return items ? [...new Set(items.map(item => item.provider.id))].length > 1 : false;
    }

    /**
     * 
     * @param {Object} payment 
     * @returns Boolean
     */
    async arePaymentsPending(payment, orderId) {
        if (payment?.type !== PAYMENT_TYPES["ON-ORDER"])
            return false;

        const paymentDetails = await juspayService.getOrderStatus(orderId);

        return payment == null ||
            payment.paid_amount <= 0 ||
            (process.env.NODE_ENV === "prod" && payment.paid_amount !== paymentDetails.amount) ||
            paymentDetails.status !== JUSPAY_PAYMENT_STATUS.CHARGED.status;
    }

    /**
    * confirm order
    * @param {Object} orderRequest
    */
    async confirmOrder(orderRequest) {
        try {
            const { context: requestContext, message: order = {} } = orderRequest || {};

            const contextFactory = new ContextFactory();
            const context = contextFactory.create({
                action: PROTOCOL_CONTEXT.CONFIRM,
                transactionId: requestContext?.transaction_id,
            });

            if (!(order?.items?.length)) {
                return {
                    context,
                    error: { message: "Empty order received" }
                };
            }
            else if (this.areMultipleBppItemsSelected(order?.items)) {
                return {
                    context,
                    error: { message: "More than one BPP's item(s) selected/initialized" }
                };
            }
            else if (this.areMultipleProviderItemsSelected(order?.items)) {
                return {
                    context,
                    error: { message: "More than one Provider's item(s) selected/initialized" }
                };
            } else if (await this.arePaymentsPending(
                order?.payment,
                orderRequest?.context?.transaction_id
            )) {
                return {
                    context,
                    error: {
                        message: "BAP hasn't received payment yet",
                        status: "BAP_015",
                        name: "PAYMENT_PENDING"
                    }
                };
            }

            const subscriberDetails = await lookupBppById({
                type: SUBSCRIBER_TYPE.BPP,
                subscriber_id: order?.items[0]?.bpp_id
            });

            return await bppConfirmService.confirmV1(
                context,
                subscriberDetails?.[0]?.subscriber_url,
                order
            );
        }
        catch (err) {
            throw err;
        }
    }

    /**
     * confirm multiple orders
     * @param {Array} orders 
     */
    async confirmMultipleOrder(orders) {

        const confirmOrderResponse = await Promise.all(
            orders.map(async orderRequest => {
                try {
                    const { 
                        context: requestContext, 
                        message: order = {} 
                    } = orderRequest || {};

                    const dbResponse = await getOrderByTransactionId(orderRequest?.context?.transaction_id);

                    if (dbResponse?.paymentStatus === null) {
                        
                        const contextFactory = new ContextFactory();
                        const context = contextFactory.create({
                            action: PROTOCOL_CONTEXT.CONFIRM,
                            transactionId: requestContext?.transaction_id,
                            bppId: dbResponse.bppId
                        });

                        if (await this.arePaymentsPending(
                            order?.payment,
                            orderRequest?.context?.transaction_id
                        )) {
                            return {
                                context,
                                error: {
                                    message: "BAP hasn't received payment yet",
                                    status: "BAP_015",
                                    name: "PAYMENT_PENDING"
                                }
                            };
                        }

                        const subscriberDetails = await lookupBppById({
                            type: SUBSCRIBER_TYPE.BPP,
                            subscriber_id: context.bpp_id
                        });

                        const bppConfirmResponse = await bppConfirmService.confirmV2(
                            context,
                            subscriberDetails?.[0]?.subscriber_url,
                            order,
                            dbResponse
                        );
                        
                        if (bppConfirmResponse?.message?.ack) {
                            let orderSchema = dbResponse?.toJSON();
                            
                            orderSchema.messageId = bppConfirmResponse?.context?.message_id;
                            if(order?.payment?.type === PAYMENT_TYPES["ON-ORDER"])
                                orderSchema.paymentStatus = PROTOCOL_PAYMENT.PAID;

                            await addOrUpdateOrderWithTransactionId(
                                bppConfirmResponse?.context?.transaction_id,
                                { ...orderSchema }
                            );
                        }

                        return bppConfirmResponse;

                    } else {
                        const contextFactory = new ContextFactory();
                        const context = contextFactory.create({
                            action: PROTOCOL_CONTEXT.CONFIRM,
                            transactionId: requestContext?.transaction_id,
                            bppId: dbResponse.bppId,
                            messageId: dbResponse.messageId
                        });

                        return {
                            context: context,
                            message: {
                                ack: {
                                    status: "ACK"
                                }
                            }
                        };
                    }
                }
                catch (err) {
                    throw err;
                }
            })
        );

        return confirmOrderResponse;
    }

    /**
    * on confirm order
    * @param {Object} messageId
    */
    async onConfirmOrder(messageId) {
        try {
            let protocolConfirmResponse = await onOrderConfirm(messageId);
            protocolConfirmResponse = protocolConfirmResponse?.[0] || {};

            if (
                protocolConfirmResponse?.context &&
                protocolConfirmResponse?.message?.order &&
                protocolConfirmResponse.context.message_id &&
                protocolConfirmResponse.context.transaction_id
            ) {
                return protocolConfirmResponse;

            } else {
                const contextFactory = new ContextFactory();
                const context = contextFactory.create({
                    messageId: messageId,
                    action: PROTOCOL_CONTEXT.ON_CONFIRM
                });

                return {
                    context,
                    error: {
                        message: "No data found"
                    }
                };
            }

        }
        catch (err) {
            throw err;
        }
    }

    /**
    * on confirm multiple order
    * @param {Object} messageId
    */
    async onConfirmMultipleOrder(messageIds) {
        try {
            const onConfirmOrderResponse = await Promise.all(
                messageIds.map(async messageId => {
                    try {
                        let protocolConfirmResponse = await this.onConfirmOrder(messageId);

                        if(protocolConfirmResponse?.message?.order) {
                            const dbResponse = await getOrderByTransactionId(protocolConfirmResponse?.context?.transaction_id);

                            let orderSchema = { ...protocolConfirmResponse?.message?.order };

                            orderSchema.messageId = protocolConfirmResponse?.context?.message_id;
                            orderSchema.billing = {
                                ...orderSchema.billing,
                                address: {
                                    ...orderSchema.billing.address,
                                    areaCode: orderSchema.billing.address.area_code
                                }
                            };
                            orderSchema.fulfillment = {
                                ...orderSchema.fulfillment,
                                end: {
                                    ...orderSchema?.fulfillment?.end,
                                    location: {
                                        ...orderSchema?.fulfillment?.end?.location,
                                        address: {
                                            ...orderSchema?.fulfillment?.end?.location?.address,
                                            areaCode: orderSchema?.fulfillment?.end?.location?.address?.area_code
                                        }
                                    }
                                },
                            };

                            await addOrUpdateOrderWithTransactionId(
                                protocolConfirmResponse.context.transaction_id,
                                { ...orderSchema }
                            );

                            protocolConfirmResponse.parentOrderId = dbResponse?.[0]?.parentOrderId;
                        }

                        return { ...protocolConfirmResponse };
                    }
                    catch (err) {
                        throw err;
                    }
                })
            );

            return onConfirmOrderResponse;
        }
        catch (err) {
            throw err;
        }
    }
}

export default ConfirmOrderService;
