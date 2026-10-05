// ============================================================
// ELEMENTS
// ============================================================

const micButton =
    document.getElementById("micButton");

const statusElement =
    document.getElementById("status");

const commandElement =
    document.getElementById("command");

const confidenceElement =
    document.getElementById("confidence");

const audioPlayer =
    document.getElementById("audioPlayer");

const nowPlaying =
    document.getElementById("nowPlaying");

const playlistContainer =
    document.getElementById(
        "playlistContainer"
    );

const playButton =
    document.getElementById(
        "playButton"
    );

const pauseButton =
    document.getElementById(
        "pauseButton"
    );

const nextButton =
    document.getElementById(
        "nextButton"
    );

const previousButton =
    document.getElementById(
        "previousButton"
    );


// ============================================================
// GLOBAL VARIABLES
// ============================================================

let websocket = null;

let audioContext = null;

let microphoneStream = null;

let processor = null;

let songs = [];

let currentSongIndex = 0;

let microphoneActive = false;


// ============================================================
// LOAD PLAYLIST
// ============================================================

async function loadSongs() {

    try {

        const response =
            await fetch("/api/songs");

        songs = await response.json();

        playlistContainer.innerHTML = "";

        if (songs.length === 0) {

            playlistContainer.innerHTML =
                "<p>No music files found.</p>";

            return;
        }


        songs.forEach(
            (song, index) => {

                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "song-item";

                item.textContent =
                    song.name;

                item.addEventListener(
                    "click",
                    () => {

                        currentSongIndex =
                            index;

                        loadSong(
                            currentSongIndex
                        );

                    }
                );

                playlistContainer.appendChild(
                    item
                );

            }
        );


        loadSong(0);

    }

    catch (error) {

        console.error(error);

        playlistContainer.innerHTML =
            "<p>Failed to load songs.</p>";
    }
}


// ============================================================
// LOAD SONG
// ============================================================

function loadSong(index) {

    if (
        songs.length === 0
    ) {

        return;
    }


    currentSongIndex = index;


    const song =
        songs[currentSongIndex];


    audioPlayer.src =
        song.url;


    nowPlaying.textContent =
        song.name;
}


// ============================================================
// PLAY
// ============================================================

async function playMusic() {

    try {

        await audioPlayer.play();

    }

    catch (error) {

        console.error(
            "Play failed:",
            error
        );

    }
}


// ============================================================
// PAUSE
// ============================================================

function pauseMusic() {

    audioPlayer.pause();
}


// ============================================================
// NEXT
// ============================================================

function nextSong() {

    if (
        songs.length === 0
    ) {

        return;
    }


    currentSongIndex++;

    if (
        currentSongIndex >=
        songs.length
    ) {

        currentSongIndex = 0;

    }


    loadSong(
        currentSongIndex
    );

    playMusic();
}


// ============================================================
// PREVIOUS
// ============================================================

function previousSong() {

    if (
        songs.length === 0
    ) {

        return;
    }


    currentSongIndex--;

    if (
        currentSongIndex < 0
    ) {

        currentSongIndex =
            songs.length - 1;

    }


    loadSong(
        currentSongIndex
    );

    playMusic();
}


// ============================================================
// BUTTON EVENTS
// ============================================================

playButton.addEventListener(
    "click",
    playMusic
);

pauseButton.addEventListener(
    "click",
    pauseMusic
);

nextButton.addEventListener(
    "click",
    nextSong
);

previousButton.addEventListener(
    "click",
    previousSong
);


// ============================================================
// WEBSOCKET
// ============================================================

function connectWebSocket() {

    const protocol =
        window.location.protocol === "https:"
            ? "wss:"
            : "ws:";


    const websocketURL =
        `${protocol}//${window.location.host}/ws`;


    websocket =
        new WebSocket(
            websocketURL
        );


    websocket.binaryType =
        "arraybuffer";


    websocket.onopen =
        () => {

            console.log(
                "WebSocket connected"
            );

            statusElement.textContent =
                "Connected to server";


            // Send microphone
            // sample rate later
        };


    websocket.onmessage =
        (event) => {

            const data =
                JSON.parse(
                    event.data
                );


            // ----------------------------------
            // STATUS
            // ----------------------------------

            if (
                data.type === "status"
            ) {

                statusElement.textContent =
                    data.message;

                return;
            }


            // ----------------------------------
            // PREDICTION
            // ----------------------------------

            if (
                data.type ===
                "prediction"
            ) {

                if (
                    data.command
                ) {

                    commandElement.textContent =
                        data.command;

                    confidenceElement.textContent =
                        "Confidence: " +
                        (
                            data.confidence *
                            100
                        ).toFixed(2) +
                        "%";

                }


                if (
                    data.status ===
                    "silence"
                ) {

                    statusElement.textContent =
                        "Listening...";

                }


                // Execute command
                // only if backend accepts it

                if (
                    data.accepted
                ) {

                    executeCommand(
                        data.command
                    );

                }

            }

        };


    websocket.onclose =
        () => {

            console.log(
                "WebSocket disconnected"
            );

            statusElement.textContent =
                "WebSocket disconnected";

        };


    websocket.onerror =
        (error) => {

            console.error(
                "WebSocket error:",
                error
            );

            statusElement.textContent =
                "WebSocket error";

        };
}


// ============================================================
// EXECUTE VOICE COMMAND
// ============================================================

function executeCommand(
    command
) {

    console.log(
        "Executing:",
        command
    );


    switch (
        command
    ) {

        case "Play":

            playMusic();

            break;


        case "Pause":

            pauseMusic();

            break;


        case "Next_track":

            nextSong();

            break;


        case "Previous_track":

            previousSong();

            break;

        default:
            break;
    }
}


// ============================================================
// MICROPHONE
// ============================================================

async function startMicrophone() {

    try {

        // ----------------------------------
        // REQUEST MICROPHONE
        // ----------------------------------

        microphoneStream =
            await navigator
                .mediaDevices
                .getUserMedia({

                    audio: {

                        echoCancellation: true,

                        noiseSuppression: true,

                        autoGainControl: true

                    }

                });


        // ----------------------------------
        // AUDIO CONTEXT
        // ----------------------------------

        audioContext =
            new (
                window.AudioContext ||
                window.webkitAudioContext
            )();


        await audioContext.resume();


        const sampleRate =
            audioContext.sampleRate;


        console.log(
            "Browser sample rate:",
            sampleRate
        );


        // ----------------------------------
        // CONNECT WEBSOCKET
        // ----------------------------------

        connectWebSocket();


        // Wait for WebSocket
        // before sending audio

        await waitForWebSocket();


        websocket.send(
            JSON.stringify({

                type: "config",

                sample_rate:
                    sampleRate

            })
        );


        // ----------------------------------
        // AUDIO SOURCE
        // ----------------------------------

        const source =
            audioContext.createMediaStreamSource(
                microphoneStream
            );


        // ----------------------------------
        // PROCESSOR
        // ----------------------------------

        processor =
            audioContext.createScriptProcessor(
                4096,
                1,
                1
            );


        processor.onaudioprocess =
            (event) => {

                if (
                    !microphoneActive
                ) {

                    return;
                }


                if (
                    !websocket ||
                    websocket.readyState !==
                    WebSocket.OPEN
                ) {

                    return;
                }


                const input =
                    event.inputBuffer
                        .getChannelData(0);


                // Copy Float32 data
                const buffer =
                    new Float32Array(
                        input.length
                    );


                buffer.set(
                    input
                );


                websocket.send(
                    buffer.buffer
                );

            };


        source.connect(
            processor
        );


        processor.connect(
            audioContext.destination
        );


        microphoneActive =
            true;


        micButton.textContent =
            "🛑 Stop Microphone";


        micButton.classList.add(
            "active"
        );


        statusElement.textContent =
            "Listening...";

    }

    catch (error) {

        console.error(
            error
        );

        statusElement.textContent =
            "Microphone permission denied";

    }
}


// ============================================================
// STOP MICROPHONE
// ============================================================

function stopMicrophone() {

    microphoneActive =
        false;


    if (processor) {

        processor.disconnect();

        processor = null;

    }


    if (
        microphoneStream
    ) {

        microphoneStream
            .getTracks()
            .forEach(
                track => track.stop()
            );

        microphoneStream = null;

    }


    if (audioContext) {

        audioContext.close();

        audioContext = null;

    }


    if (websocket) {

        websocket.close();

        websocket = null;

    }


    micButton.textContent =
        "🎤 Start Microphone";


    micButton.classList.remove(
        "active"
    );


    statusElement.textContent =
        "Microphone stopped";

}


// ============================================================
// MICROPHONE BUTTON
// ============================================================

micButton.addEventListener(
    "click",
    () => {

        if (
            microphoneActive
        ) {

            stopMicrophone();

        }

        else {

            startMicrophone();

        }

    }
);


// ============================================================
// WAIT FOR WEBSOCKET
// ============================================================

function waitForWebSocket() {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const timeout =
                setTimeout(
                    () => {

                        reject(
                            new Error(
                                "WebSocket timeout"
                            )
                        );

                    },
                    5000
                );


            const check =
                setInterval(
                    () => {

                        if (
                            websocket &&
                            websocket.readyState ===
                            WebSocket.OPEN
                        ) {

                            clearInterval(
                                check
                            );

                            clearTimeout(
                                timeout
                            );

                            resolve();

                        }

                    },
                    50
                );

        }
    );
}


// ============================================================
// INITIALIZE
// ============================================================

loadSongs();
