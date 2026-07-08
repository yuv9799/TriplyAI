import { Inngest } from "inngest";

export const inngest = new Inngest({
    id: "triply",
    eventKey: process.env.INNGEST_EVENT_KEY,
});