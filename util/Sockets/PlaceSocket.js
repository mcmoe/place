const {EventEmitter} = require("events");
const logger = require('../logger');
const badRequest = (error) => ["bad_request", {success: false, error: error ? {message: error} : undefined}];
exports.PlaceSocket = class PlaceSocket extends EventEmitter {
    /**
     * @param {ws} socket The socket
     * @param {{activityThresholdMilliseconds: number}} options the options object
     */
    constructor(socket, options) {
        super();
        /**
         * @type {ws}
         */
        this.socket = socket;
        /**
         * @type {() => void}
         */
        this._closeFunction = () => undefined;
        this.lastMessage = Date.now();
        
        this.isClient = false;
        this.identified = false;
        
        this.shouldBeTimedOut = true;

        this.timeoutStats = {
            checkedForActivity: false,
            warned: false,
        }

        socket.onmessage = event => {
            let data = String.fromCharCode.apply(null, new Uint8Array(event));
            try {
                data = JSON.parse(data);
            } catch (e) {
                this.close(...badRequest(e.message));
                return;
            }
            const {r, d} = data;
            if (!r || typeof r !== "string") {
                this.close(...badRequest("Bad request types."));
                return;
            }
            if (r === "identify") {
                if (this.identified) {
                    this.close(...badRequest("Already identified."));
                    return;
                }
                if (typeof d === "object") {
                    this.identified = true;
                    this.isClient = d.clientType === "client";
                } else {
                    this.close(...badRequest("Bad identify payload."));
                    return;
                }
            }
            this.stat();
            this.emit(r, d);
        }

        this.dispatch("hello", {options: {activityTimeout: options.activityThresholdMilliseconds}});

        this.on("activity", () => this.resetTimeoutStats());

        socket.onerror = () => {
            logger.log('onerror socket');
            this._closeFunction();
        }

        socket.onclose = () => {
            logger.log('onclose socket');
            this._closeFunction();
        }
    }

    /**
     * Dispatches a payload with the given event name
     * 
     * @param {string} event The event name
     * @param {any} payload The payload
     */
    dispatch(event, payload) {
        return new Promise((resolve, reject) => {
            this.socket.send(JSON.stringify({e: event, d: payload}), (e) => e ? reject(e) : resolve());
        });
    }

    /**
     * Closes the socket connection
     * 
     * @param {string} event the closing event name
     * @param {any} payload the closing payload name
     */
    async close(event = undefined, payload = undefined) {
        await this.dispatch(event, payload).catch(e => logger.log('close dispatch', e));
        try { this.socket.close(); } catch(e) { logger.log('close socket', e); }
        this._closeFunction();
    }

    /**
     * Returns the socket IP
     * 
     * @type {string}
     */
    get ip() {
        const ip = this.remoteAddressToString(this.socket.getRemoteAddress());
        if (typeof ip !== "string") {
            return undefined;
        }
        return ip;
    }

    /**
     * https://github.com/uNetworking/uWebSockets.js/issues/58#issuecomment-567454532
     * @param {string} address 
     */
    remoteAddressToString(address) {
        if (address.byteLength == 4) {//IPv4
            return new Uint8Array(address).join('.');
        } else if (address.byteLength == 16) {//IPv6
            let arr = Array.from(new Uint16Array(address));
            if (arr[0] == 0 && arr[1] == 0 && arr[2] == 0 && arr[3] == 0 && arr[4] == 0 && arr[5] == 0xffff)  //IPv4 mapped to IPv6
                return new Uint8Array(address.slice(12)).join('.');
            else
                return Array.from(new Uint16Array(address)).map(v => v.toString(16)).join(':').replace(/((^|:)(0(:|$))+)/, '::');
        }
    }

    /**
     * Returns whether the socket is currently open
     * 
     * @type {string}
     */
    get open() {
        return this.socket.readyState === this.socket.OPEN;
    }

    /**
     * Updates the latest timestamp
     */
    stat() {
        this.lastMessage = Date.now();
    }

    /**
     * Resets the timeout statistics
     */
    resetTimeoutStats() {
        this.timeoutStats.checkedForActivity = false;
        this.timeoutStats.warned = false;
    }
}
