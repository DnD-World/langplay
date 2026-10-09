declare module "virtual:langplay-runtime" {
  /** IIFE that defines `var Langplay = { runRecipe, createChat, ... }`. */
  export const ENGINE_JS: string;
  /** IIFE that defines `var Langplay = { mountRunner }` (engine included). */
  export const RUNNER_JS: string;
}
