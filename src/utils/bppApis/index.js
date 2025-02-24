import HttpRequest from "../HttpRequest.js";
import BPP_API_URLS from "./routes.js";

/**
 * confirm order
 * @param {String} bppUri 
 * @param {Object} order 
 */
const bppConfirm = async (bppUri, order) => {

    const apiCall = new HttpRequest(
        bppUri,
        BPP_API_URLS.CONFIRM,
        "POST",
        order
    );

    const result = await apiCall.send();
    return result.data;
};

/**
 * cancel order
 * @param {String} bppUri 
 * @param {Object} order 
 */
const bppCancel = async (bppUri, order) => {

    const apiCall = new HttpRequest(
        bppUri,
        BPP_API_URLS.CANCEL,
        "POST",
        order
    );

    const result = await apiCall.send();
    return result.data;
};

/**
 * initialize order
 * @param {String} bppUri 
 * @param {Object} order 
 */
const bppInit = async (bppUri, order) => {

    const apiCall = new HttpRequest(
        bppUri,
        BPP_API_URLS.INIT,
        "POST",
        order
    );

    const result = await apiCall.send();
    return result.data;
};

/**
 * search
 * @param {String} bppUri 
 * @param {Object} criteria 
 */
const bppSearch = async (bppUri, criteria) => {

    const apiCall = new HttpRequest(
        bppUri,
        BPP_API_URLS.SEARCH,
        "POST",
        criteria
    );

    const result = await apiCall.send();
    return result.data;
};

/**
 * track order
 * @param {String} bppUri 
 * @param {Object} trackRequest 
 */
const bppTrack = async (bppUri, trackRequest) => {

    const apiCall = new HttpRequest(
        bppUri,
        BPP_API_URLS.TRACK,
        "POST",
        trackRequest
    );

    const result = await apiCall.send();
    return result.data;
};

/**
 * support
 * @param {String} bppUri 
 * @param {Object} supportRequest 
 */
const bppSupport = async (bppUri, supportRequest) => {

    const apiCall = new HttpRequest(
        bppUri,
        BPP_API_URLS.SUPPORT,
        "POST",
        supportRequest
    );

    const result = await apiCall.send();
    return result.data;
};

/**
 * order status
 * @param {String} bppUri 
 * @param {Object} trackRequest 
 */
const bppOrderStatus = async (bppUri, trackRequest) => {

    const apiCall = new HttpRequest(
        bppUri,
        BPP_API_URLS.STATUS,
        "POST",
        trackRequest
    );

    const result = await apiCall.send();
    return result.data;
};

export { bppCancel, bppConfirm, bppInit, bppSearch, bppOrderStatus, bppSupport, bppTrack };
