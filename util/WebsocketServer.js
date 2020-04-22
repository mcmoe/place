const ws = require("uws");
const Pixel = require("../models/pixel");
const {SocketController} = require("./Sockets/SocketController");

function WebsocketServer(app) {
    app.logger.log('Websocket Server', "Attached to HTTP server.");

    class SocketServer {

        constructor() {
            const wsHost = process.env.WSHOST || app.config.wsHost;
            const wsPort = process.env.WSPORT || app.config.wsPort
            this.server = ws.App().ws('/*', {
                open: (ws, req) => { 
                    this.socketController.register(ws); 
                },
                message:  (ws, event, isBinary) => {
                    ws.onmessage(event);
                },
                close: (ws, code, message) => {
                    ws.onclose(code, message);
                }
            }).listen(wsHost, wsPort, (s) => {
                if(s) {
                    app.logger.log('WebSocketServer', `listening on ${wsHost}:${wsPort}...`, s);
                }
            });
            setInterval(() => this.checkUserCount(), 1000);

            this.socketController = new SocketController();
            this.socketController.use((socket, next) => {
                socket.on("fetch_pixels", data => {
                    const {ts} = data;
                    const currentTS = Math.floor(Date.now() / 1000);
                    if (!ts || (ts < (currentTS - 60)) || (ts > currentTS)) {
                        return;
                    }
                    const selectorDate = new Date(ts * 1000);
                    Pixel.find({lastModified: {$gte: selectorDate}}).then((pixel) => {
                        const info = pixel.map((p) => p.getSocketInfo());
                        socket.dispatch("tiles_placed", {pixels: info});
                    }).catch((err) => {
                        app.logger.capture("Error fetching pixel for websocket client: " + err);
                    });
                });
                next();
            });
        }

        /**
         * Broadcasts to all clients the new client count
         * 
         * @param {number} connectedClients The number of clients to broadcast
         */
        sendConnectedClientBroadcast(connectedClients = this.socketController.connectedClients) {
            this.broadcast("user_change", connectedClients);
        }

        /**
         * Broadcasts a payload to all connected clients
         * 
         * @param {string} name payload name
         * @param {any} payload actual payload data
         */
        broadcast(name, payload = undefined) {
            return this.socketController.dispatch(name, payload);
        }

        /**
         * Checks the current user count against the last broadcasted and broadcasts the new count if it has changed
         */
        checkUserCount() {
            const connectedClients = this.socketController.connectedClients;
            if (this.lastConnectedClientBroadcastCount !== connectedClients) {
                this.lastConnectedClientBroadcastCount = connectedClients;
                this.sendConnectedClientBroadcast(connectedClients);
            }
        }

        /**
         * Proxies to the socketController
         */
        get connectedClients() {
            return this.socketController.connectedClients;
        }
    }

    return new SocketServer();
}

WebsocketServer.prototype = Object.create(WebsocketServer.prototype);

module.exports = WebsocketServer;