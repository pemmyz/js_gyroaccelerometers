# js_gyroaccelerometers


## Play it now: https://pemmyz.github.io/js_gyroaccelerometers/


# Gyro Table Game

A browser-based physics game where you control a ball on a tilting board
using device sensors (mobile) or mouse input (desktop).

## Features

-   📱 Mobile tilt controls using gyroscope & accelerometer
-   🖱️ Desktop mouse-based tilt simulation
-   ⚙️ Options menu:
    -   Tilt responsiveness (Linear / Logarithmic)
    -   Adjustable board size (real-time scaling)
-   🎯 Calibration system for accurate control
-   📊 Live sensor stats HUD (tilt, acceleration, gyro)
-   🧠 Physics powered by Planck.js (Box2D)

## How to Run

### Option 1: Local (Desktop)

1.  Download all project files
2.  Open `index.html` in a browser

### Option 2: Mobile (Recommended)

Due to browser security restrictions, sensors require HTTPS.

-   Use a local HTTPS server OR
-   Deploy to GitHub Pages

## Controls

### Mobile

-   Tilt your device to move the ball
-   Keep device flat during calibration

### Desktop

-   Move mouse to tilt the board

## Project Structure

-   `index.html` -- Main HTML structure
-   `style.css` -- UI and 3D styling
-   `script.js` -- Game logic, physics, and input handling

## Dependencies

-   [Planck.js](https://github.com/shakiba/planck.js)

Loaded via CDN:

    https://cdn.jsdelivr.net/npm/planck-js@0.3.31/dist/planck.min.js

## Notes

-   Sensors only work in secure contexts (HTTPS)
-   iOS requires explicit permission for motion sensors
-   Fullscreen mode improves mobile experience

## Ideas for Future Improvements

-   Obstacles / maze levels
-   Multiplayer or score tracking
-   Sound effects & polish
-   Custom maps

------------------------------------------------------------------------

Made with ❤️ using JavaScript and physics simulation.
