/**
 * @module
 */
import { ProtocolVersion, BinMsg } from "./imchat";

class IRCConnectionBase {
    /** @type {URL}
       * @protected
       */
    _server;
    /** @type {Record<keyof IRCEventTypes, ((...args: unknown[]) => void)[]>}
       * @default {}
       */
    #eventListeners = {};
    /** @param {URL} server the server hosting the IRC */
    constructor(server) {
        this._server = server;
    }
    /**
       * @returns {boolean}
       */
    get connected() {
        throw "get connected() is not implemented in an IRC connection class!";
        return false;
    }
    /**
     * Sends a message
       * @abstract
       * @param {string} message the message to send
       * @returns {Promise<void>}
       */
    async send(message) {
        throw "send(message) is not implemented in an IRC connection class!";
    }
    /**
       * @template {keyof IRCEventTypes} K
       * @template {IRCEventTypes[K]} V
       * @param {K} t
       * @param {(data: V) => void} handler
       * @returns {void}
       */
    addEventListener(t, handler) {
        this.#eventListeners[t] ??= [];
        this.#eventListeners[t].push(handler);
    }
    /**
       * @template {keyof IRCEventTypes} K
       * @template {IRCEventTypes[K]} V
       * @param {K} t
       * @param {(data: V) => void} handler
       * @returns {boolean}
       */
    removeEventListener(t, handler) {
        const idx = this.#eventListeners?.[t].indexOf(handler) ?? -1;
        if (idx === -1) {
            return false;
        }
        this.#eventListeners[t].splice(idx, 1);
        return true;
    }
    /**
       * @protected
       * @template {keyof IRCEventTypes} K
       * @template {IRCEventTypes[K]} V
       * @param {K} t
       * @param {V} d
       * @returns {void}
       */
    emit(t, d) {
        this.#eventListeners?.[t].forEach(e => { e(d); });
    }
    /**
     * Connects to the IRC
       * @param {string} user
       * @param {string | undefined} platformID
       * @returns {void}
       */
    connect(user, platformID) {
        throw "connect() is not implemented in an IRC connection class!";
    }
    /**
       * Disconnects from the IRC
       * @returns {void}
       */
    disconnect() {
        throw "disconnect() is not implemented in an IRC connection class!";
    }
}
/**
 * an IRC connection using the `/listen` SSE endpoint.
 * @extends IRCConnectionBase
 */
class IRCConnectionV1 extends IRCConnectionBase {
    /**
     * @type {EventSource | undefined}
     */
    #source = undefined;
    /** @type {string} */
    #user;
    /** @type {string | undefined} */
    #platformID;
    /**
       * @returns {boolean}
       */
    get connected() {
        return this.#source !== undefined;
    }
    /** @default URL */
    #listenEndpoint = new URL("/listen", this._server);
    // not implementing protected platform ID sending because I'm lazy.
    /** @default URL */
    #sendEndpoint = new URL("/send", this._server);
    /**
     * Sends a message via IRC
       * @param {string} message the message to send
       * @returns {Promise<void>}
       */
    async send(message) {
        const u = new URL(this.#sendEndpoint);
        u.searchParams.set("author", this.#user);
        u.searchParams.set("platformID", this.#platformID);
        await fetch(u, {
            method: "POST",
            body: message
        });
    }
    /** @param {MessageEvent<string>} e
       * @returns {void}
       */
    #onIRCMessage(e) {
        const { message, author, platformID } = JSON.parse(e.data);
        this.emit("message", {
            message,
            author,
            platformID
        });
    }
    /**
     * Connects to the IRC
       * @param {string} _user
       * @param {string|undefined} _platformID server defaults to imchat:default but it could change at any time.
       * @returns {void}
       */
    connect(_user, _platformID) {
        if (this.#source)
            this.disconnect();
        this.#source = new EventSource(this.#listenEndpoint);
        this.#source.addEventListener("message", this.#onIRCMessage);
    }
    /**
       * @returns {void}
       */
    disconnect() {
        this.#source?.close();
        this.#source = undefined;
    }
}
/**
 * an IRC connection using the /v1/ws endpoint
 * @extends IRCConnectionBase
 */
class IRCConnectionV2 extends IRCConnectionBase {
    #socket;
    /** @default URL */
    #listenEndpoint = new URL("/v1/ws", this._server);
    /**
       * @static
       * @readonly
       * @default ProtocolVersion
       */
    static #protocolVersion = ProtocolVersion.INITIAL;
    /**
       * @param {MessageEvent<ArrayBuffer>} e
       * @returns {void}
       */
    #onSocketMessage(e) {
        if (!(e.data instanceof ArrayBuffer))
            return;
        const { msg, author, platformID } = BinMsg.read(IRCConnectionV2.#protocolVersion, e.data);
        this.emit("message", {
            message: msg,
            author,
            platformID
        });
    }
    /**
       * @param {string} message
       * @returns {Promise<void>}
       */
    async send(message) {
        this.#socket.send(message);
    }
    /**
       * @param {string} user
       * @param {PlatformID} platformID
       * @returns {void}
       */
    connect(user, platformID) {
        const u = new URL(this.#listenEndpoint);
        u.searchParams.set("platformID", platformID);
        u.searchParams.set("username", user);
        u.searchParams.set("protocolVersion", ProtocolVersion.INITIAL.toString(10));
        this.#socket = new WebSocket(u);
        this.#socket.binaryType = "arraybuffer";
        this.#socket.addEventListener("message", this.#onSocketMessage);
    }
    /**
       * @returns {void}
       */
    disconnect() {
        this.#socket?.close();
        this.#socket = undefined;
    }
}
/** @type {(typeof IRCConnectionBase)[]} */
const order = [IRCConnectionV2, IRCConnectionV1];
/**
 * Tries to connect using WebSockets and falls back to SSE + POST
 * @extends IRCConnectionBase
 */
export default class IRCConnection extends IRCConnectionBase {
    // 2 retries per IRC connection type.
    /**
       * @static
       * @readonly
       * @default number
       */
    static MAX_RETRIES = order.length * 2;
    #currentRetries = 0;
    #currentIdx = 0;
    #currentConnection = new order[this.#currentIdx](this._server);
    /**
       * @param {string} user
       * @param {PlatformID} platformID
       * @returns {void}
       */
    connect(user, platformID) {
        try {
            return this.#currentConnection.connect(user, platformID);
        }
        catch (e) {
            const retry = this.#currentRetries <= IRCConnection.MAX_RETRIES;
            console.error(`Connection using ${this.#currentConnection.constructor.name} failed`);
            if (!retry) {
                throw `All IRC connections failed 2 times, not retrying. total retries: ${this.#currentRetries}`;
            }
            this.#currentRetries++;
            const next = this.#currentIdx++ % order.length;
            this.#currentIdx = next;
            this.#currentConnection = new order[next](this._server);
            return this.connect(user, platformID);
        }
    }
}
/** @typedef {`${string}:${string}`} PlatformID */
/**
 * @typedef {Object} Message
 * @property {string} message
 * @property {string} [author]
 * @property {PlatformID} [platformID]
 */
/**
 * @typedef {Object} IRCEventTypes
 * @property {Message} message
 */
