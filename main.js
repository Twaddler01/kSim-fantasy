// main.js

import { startGame } from "./src/app/startGame.js";

startGame();

console.log({
    fullscreen: matchMedia("(display-mode: fullscreen)").matches,
    standalone: matchMedia("(display-mode: standalone)").matches,
    viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        screenHeight: window.screen.height
    }
});