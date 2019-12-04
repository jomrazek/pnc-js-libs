import { Build } from "@project-ncl/pnc-dto-types";
import BuildChangedNotification from "./dto/BuildChangedNotification";
import { JobNotificationProgress } from "./dto/JobNotificationProgress";
import Notification from "./dto/Notification";
import { isBuildChangedNotification } from "./dto/TypeGuards";
import { Entity, Listener, ListenerUnsubscriber, Predicate } from "./GenericTypes";
import { BuildListener } from "./Listeners";
import { BuildStatus } from "./dto/BuildStatus";

type Dispatcher = (notification: Notification) => void;
export default class MessageBus {
    private readonly url: string;
    private ws: WebSocket;

    private dispatchers: Dispatcher[] = [];

    constructor(url: string) {
        this.url = url;
    }

    public async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);
            this.ws.addEventListener("open", () => resolve());
            this.ws.addEventListener("message", message => this.dispatch(message));
        });
    }

    public async close(): Promise<CloseEvent> {
        return new Promise(resolve => {
            if (this.ws.readyState === this.ws.CLOSED) {
                resolve();
                return;
            }
            this.ws.addEventListener("close", event => resolve(event));
            this.ws.close(1000, "Client session finished");
        });
    }

    public onBuildProgressChange(listener: BuildListener): ListenerUnsubscriber {

        const dispatcher: Dispatcher = notification => {
            if (isBuildChangedNotification(notification)) {
                listener(notification.build, notification);
            }
        };

        return this.addDispatcher(dispatcher);
    }

    public onBuildStatusChange(listener: BuildListener): ListenerUnsubscriber {
        return this.addDispatcher(notification => {
            if (isBuildChangedNotification(notification)) {
                listener(notification.build, notification);
            }
        });
    }

    public onBuildStatus(status: BuildStatus, listener: BuildListener): ListenerUnsubscriber {
        return this.addDispatcher(notification => {
            if (isBuildChangedNotification(notification) && notification.build.status === status) {
                listener(notification.build, notification);
            }
        });
    }


    private addDispatcher(dispatcher: Dispatcher): ListenerUnsubscriber {
        this.dispatchers.push(dispatcher);
        return () => this.removeDispatcher(dispatcher);
    }
    private removeDispatcher(dispatcher: Dispatcher): void {
        const index: number = this.dispatchers.indexOf(dispatcher);
        if (index >= 0) {
            this.dispatchers.splice(index, 1);
        }
    }

    private dispatch(message: MessageEvent) {
        const notification: Notification = JSON.parse(message.data);
        this.dispatchers.forEach(dispatcher => dispatcher(notification));
    }
}