import { writable } from "svelte/store";

/** Whether the node answered the last time it was asked. */
export const nodeAnswers = writable(true);
