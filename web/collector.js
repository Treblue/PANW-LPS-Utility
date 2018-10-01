let Client = require('ssh2').Client;

const REGEX_CONNECTED_DEVICES_HEADER = /Connected/;
const REGEX_IPV4_ADDRESS = /(?:localhost)|(?:(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))/g;
const REGEX_INVALID_SYNTAX = /Invalid syntax\./;
const REGEX_FIREWALL_RATE = /Log incoming rate:\s*([0-9]+)/;
const REGEX_PANORAMA_RATE = /Incoming log rate\s*=\s*([0-9]+(?:\.[0-9]+)?)/;
const REGEX_SHELL_PROMPT = /> $/;

const CONNECTED_DEVICES_COMMAND = "show devices connected";
const FIREWALL_COMMAND = "debug log-receiver statistics";
const PANORAMA_COMMAND = "debug log-collector log-collection-stats show incoming-logs";
const CLI_PAGER_COMMAND = "set cli pager off";

const STATE_READY = 0;
const STATE_DETECT_REQUEST = 1;
const STATE_DETECT_RESPONSE = 2;
const STATE_SAMPLE_REQUEST = 3;
const STATE_SAMPLE_RESPONSE = 4;

function collect(address, username, password, samples, timeout, updateProgress) {
    return new Promise((resolve, reject) => {
        let ssh = new Client();
        let result = [];

        ssh.on("ready", () => {
            let state = STATE_READY;
            let firewall = null;
            let cmd = null;
            let regex = null;

            ssh.shell((err, stream) => {
                if (err) reject(err);

                function send(cmd) {
                    stream.stdout.write(cmd + "\r");
                }

                stream.on("close", function () {
                    ssh.end();
                }).on("data", function (data) {
                    console.log("(" + address + ") " + data.toString());

                    if (state === STATE_READY && REGEX_SHELL_PROMPT.test(data)) {
                        state = STATE_DETECT_REQUEST;

                        console.log("=== SET CLI PAGER OFF: " + address + " ===");

                        send(CLI_PAGER_COMMAND);
                    } else if (state === STATE_DETECT_REQUEST && REGEX_SHELL_PROMPT.test(data)) {
                        state = STATE_DETECT_RESPONSE;

                        console.log("=== REQUESTING DEVICE TYPE: " + address + " ===");

                        send(PANORAMA_COMMAND);
                    } else if (state === STATE_DETECT_RESPONSE && (REGEX_INVALID_SYNTAX.test(data) || REGEX_PANORAMA_RATE.test(data))) {
                        state = STATE_SAMPLE_REQUEST;

                        firewall = REGEX_INVALID_SYNTAX.test(data);

                        console.log("=== DETECTED DEVICE TYPE (" + (firewall ? "firewall" : "panorama") + "): " + address + " ===");

                        cmd = firewall ? FIREWALL_COMMAND : PANORAMA_COMMAND;
                        regex = firewall ? REGEX_FIREWALL_RATE : REGEX_PANORAMA_RATE;
                    } else if (state === STATE_SAMPLE_REQUEST && REGEX_SHELL_PROMPT.test(data)) {
                        state = STATE_SAMPLE_RESPONSE;

                        console.log("=== REQUESTING SAMPLES: " + address + " ===");

                        /* Execute an initial sample in order to avoid the fact that setInterval waits 10 seconds before the first iteration. */
                        send(cmd);

                        let sample = 1;
                        let sampleInterval = setInterval(() => {
                            if (sample < samples) {
                                send(cmd);
                                sample++;
                            } else clearInterval(sampleInterval);
                        }, 10 * 1000);
                    } else if (state === STATE_SAMPLE_RESPONSE && regex.test(data)) {
                        let rate = regex.exec(data)[1];
                        result.push(rate);
                        updateProgress();

                        console.log("=== COLLECTING SAMPLE (" + rate + " LPS): " + address + " ===");

                        if (result.length === samples) {
                            resolve({
                                "samples": result,
                                "firewall": firewall
                            });
                            ssh.end();
                        }
                    }
                });
            });
        }).on("error", (err) => {
            reject(err);
        }).connect({
            host: address,
            username: username,
            password: password,
            readyTimeout: timeout * 1000
        });
    });

    // set cli pager off
    // fw: debug log-receiver statistics
    // cms: debug log-collector log-collection-stats show incoming-logs
}

function getConnectedDevices(address, username, password, timeout) {
    return new Promise((resolve, reject) => {
        let ssh = new Client();
        let setup = false;

        ssh.on("ready", () => {
            ssh.shell((err, stream) => {
                if (err) reject(err);

                function send(cmd) {
                    stream.stdout.write(cmd + "\r");
                }

                stream.on("close", () => ssh.end()).on("data", function (raw) {
                    let data = raw.toString();
                    console.log(data);

                    if (!setup && REGEX_SHELL_PROMPT.test(data)) {
                        send(CLI_PAGER_COMMAND);
                        send(CONNECTED_DEVICES_COMMAND);
                        setup = true;
                    } else if (setup && REGEX_IPV4_ADDRESS.test(data)) {
                        /* Ensure all of the IP addresses are matched. */
                        REGEX_IPV4_ADDRESS.lastIndex = 0;

                        let result = [];
                        let groups;
                        while ((groups = REGEX_IPV4_ADDRESS.exec(data)) != null) {
                            result.push(groups[0]);
                        }
                        console.log(result);

                        resolve(result);
                        ssh.end();
                    } else if (setup && REGEX_CONNECTED_DEVICES_HEADER.test(data)) {
                        reject("empty");
                        ssh.end();
                    } else if (setup && REGEX_INVALID_SYNTAX.test(data)) {
                        reject("device");
                        ssh.end();
                    }
                });
            });
        }).on("error", (err) => {
            reject(err);
        }).connect({
            host: address,
            username: username,
            password: password,
            readyTimeout: timeout * 1000
        });
    });
}

module.exports = { collect, getConnectedDevices };