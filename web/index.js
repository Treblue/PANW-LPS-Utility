let collector = require("./collector.js");
let fs = require("fs");
let $ = require("jquery");
let { remote } = require("electron");
let win = remote.getCurrentWindow();

let REGEX_SPACE_CHARACTERS = /\s*/g;
let REGEX_IPV4_ADDRESS = "(?:localhost)|((?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))";
let REGEX_ADDRESS = new RegExp("^(" + REGEX_IPV4_ADDRESS + ")(?:\\s*,\\s*(" + REGEX_IPV4_ADDRESS + "))*$");
let REGEX_SAMPLES = /^(?:[1-9][0-9]*)?$/;
let REGEX_TIMEOUT = /^(?:[1-9][0-9]*)?$/;
let REGEX_LOG_DAYS = /^[0-9]*$/;
let REGEX_LOG_SIZE = /^[0-9]*$/;
let REGEX_USERNAME = /^.*$/;
let REGEX_PASSWORD = /^.+$/;

/* Keep track of parameters which need to be validated a regular expression mapped to their regular expression, parser function, default value, and ready state. */
const parameters = {
    "username": {
        "regex": REGEX_USERNAME
    },
    "password": {
        "regex": REGEX_PASSWORD
    },
    "samples": {
        "regex": REGEX_SAMPLES,
        "parse": parseInt
    },
    "timeout": {
        "regex": REGEX_TIMEOUT,
        "parse": parseInt
    },
    "days": {
        "regex": REGEX_LOG_DAYS,
        "parse": parseInt
    },
    "size": {
        "regex": REGEX_LOG_SIZE,
        "parse": parseInt
    }
};

function setupParameters() {
    for (let name in parameters) {
        let defaultValue = $("input[name=" + name + "]").attr("default");
        parameters[name]["default"] = defaultValue;
        parameters[name]["ready"] = defaultValue !== undefined;
    }
}

function checkParameters() {
    for (let name in parameters) {
        if (parameters[name]["ready"] === false) {
            return false;
        }
    }
    return true;
}

function getParameters() {
    let result = {};
    for (let name in parameters) {
        let parameter = parameters[name];
        let value = $("input[name=" + name + "]").val();

        if (value.length === 0 && parameter["default"] !== undefined) value = parameter["default"];
        if (parameter.hasOwnProperty("parse")) value = parameter["parse"](value);

        result[name] = value;
    }
    return result;
}

/* Simulate appending the CSV value to the address field and automatically press the enter key (safer than using add hosts, as the enter key validation matches regex). */
function enterCSV(csv, keep = true) {
    let field = $("input[name=address]");
    let input = field.val().replace(REGEX_SPACE_CHARACTERS, "");

    field.val((keep && input.length !== 0 ? input + "," : "") + csv);
    field.trigger($.Event("keydown", { which: 13 }));
}

function importCSV() {
    openCSV().then((result) => {
        for (let key in result) {
            let csv = result[key];
            enterCSV(csv);
        }
        showModal("info", "Import Successful <button class=\"delete\" onclick=\"hideModal()\"></button>", "You may now close this window to return to the main page.");
    }).catch((err) => {
        showModal("warning", "We couldn't import the specified CSV/CSVs <button class=\"delete\" onclick=\"hideModal()\"></button>", err);
    });
}

function importPanorama() {
    /* Do not import connected devices if any of the parameters are not yet ready. */
    if (!checkParameters()) {
        showModal("warning", "Missing Information <button class=\"delete\" onclick=\"hideModal()\"></button>", "Specify the username and password of the Panorama devices specified in the IP address bar before choosing this import option.");
        return;
    }

    let addresses = splitHosts($("input[name=address]").val());

    /* Do not import connected devices if no IP addresses of Panorama devices are specified in the address bar. */
    if (addresses === null || addresses.length === 0) {
        showModal("warning", "Missing Information <button class=\"delete\" onclick=\"hideModal()\"></button>", "Specify at least one IP address of a Panorama device in the IP address bar (without pressing the enter key) before choosing this import option.");
        return;
    }

    let args = getParameters();
    let remaining = addresses.length;
    let fails = [];

    function showProgressModal() {
        showModal("info", "Import Progress <i class=\"fas fa-spinner\"></i>", "<progress class=\"progress is-info\" value=\"" + (addresses.length - remaining) + "\" max=\"" + addresses.length + "\"></progress>");
    }
    showProgressModal();

    for (let key in addresses) {
        let address = addresses[key];

        function updateResult() {
            if (remaining === 0) {
                let failures = "";
                if (fails.length !== 0) {
                    for (let key in fails) {
                        let fail = fails[key];
                        failures += (failures === "" ? "" : ", ") + fail;
                    }
                    showModal("danger", "Import Error <button class=\"delete\" onclick=\"hideModal()\"></button>", "These devices were not suitable for Panorama import: " + failures);
                } else {
                    showModal("info", "Import Successful <button class=\"delete\" onclick=\"hideModal()\"></button>", "You may now close this window to return to the main page.");
                }
            } else {
                showProgressModal();
            }
        }

        collector.getConnectedDevices(address, args.username, args.password, args.timeout).then((addresses) => {
            let csv = "";
            for (let key in addresses) {
                let address = addresses[key];
                csv += (csv === "" ? "" : ",") + address;
            }
            enterCSV(csv, false);
            remaining--;

            updateResult();
        }).catch((err) => {
            if (err === "device") fails.push(address);
            remaining--;

            updateResult();
        });
    }

    /* TODO: use connection info from main page and addresses in address bar to import */
    /*
    showModal("info", "Specify Connection Details of Panorama Device (press ENTER to continue)", "<input type='text' name='panorama-address' placeholder='IP Address'/><input type='text' name='panorama-username' placeholder='Username'/><input type='text' name='panorama-password' placeholder='Password'/>");

    registerEnterKeyFormValidation("panorama-address", new RegExp(REGEX_IPV4_ADDRESS), (address) => {
        collector.getConnectedDevices(address, username, password)
    });
    */
}

function collectSamples() {
    if (!checkParameters()) return; /* Do not collect samples if any of the parameters are not yet ready. */

    /* If no addresses have been added to the list, then either automatically add the content of the "address" text field to the list and continue or do not collect samples. */
    if ($(".address").length == 0) {
        if ($("input[name=address]").val().length === 0) return; /* Do not collect samples if no addresses were entered to the text field. */

        /* Automatically press the enter key on the address field for the user if they have not done so already, but there is still content inside of the text box. */
        $("input[name=address]").trigger($.Event("keydown", { which: 13 }));
    }

    if ($(".address").length == 0) return; /* If there are still no addresses in the list, then do not collect samples. */

    let resultsByAddress = {};

    /* let device = $("input[name=device]:checked").val(); */
    let args = getParameters();

    /* let firewall = device === "fw"; */
    let totalSamples = args.samples * $(".address").length;
    let completedSamples = 0;

    function showProgressModal() {
        showModal("info", "Collecting Samples <i class=\"fas fa-spinner\"></i>", "<progress class=\"progress is-info\" value=\"" + completedSamples + "\" max=\"" + totalSamples + "\"></progress>");
    }
    showProgressModal();

    $(".address").each((index, element) => {
        let address = $(element).attr("name").trim();

        function updateProgress() {
            $(".modal progress").attr("value", ++completedSamples);
        }

        collector.collect(address, args.username, args.password, args.samples, args.timeout, updateProgress).then((result) => {
            resultsByAddress[address] = result;

            if (completedSamples === totalSamples) {

                /* Keep track of column totals as we go */
                let totalDevice = "";
                let totalAverage = 0;
                let totalMax = 0;
                let totalMin = 0;
                let totalStorage = 0;

                /* Format the HTML table and CSV simultaneously */
                let table = "<table class=\"table is-bordered\"><thead><tr><th>IP Address</th><th>Device Type</th><th>Avg LPS</th><th>Max LPS</th><th>Min LPS</th><th>Est. Storage</th></tr></thead><tbody>";
                let csv = "\"IP Address\",\"Device Type\",\"Avg LPS\",\"Max LPS\",\"Min LPS\",\"Est. Storage\"";

                /*
                for (let web = 1; web <= samples; web++) {
                    table += "<th>Sample" + web + "</th>";
                }
                */

                for (address in resultsByAddress) {

                    /* Calculate Row */
                    let current = resultsByAddress[address];
                    let sum = 0;
                    let max = null;
                    let min = null;
                    for (index in current.samples) {
                        let rate = parseFloat(current.samples[index]);
                        if (max == null || rate > max) max = rate;
                        if (min == null || rate < min) min = rate;
                        sum += rate;
                    }
                    let average = (sum / current.samples.length);
                    let storage = (average * 86400 * args.days * args.size) / 1000000000;
                    let device = current.firewall ? "firewall" : "panorama";

                    /* Update Table */
                    table += "<tr>"
                           + "<th>" + address + "</th>"
                           + "<th>" + device + "</th>"
                           + "<th>" + average.toFixed(2) + "</th>"
                           + "<th>" + max + "</th>"
                           + "<th>" + min + "</th>"
                           + "<th>" + storage.toFixed(2) + " GB</th>"
                           + "</tr>";

                    /* Update CSV */
                    csv += "\n\"" + address
                         + "\",\"" + device
                         + "\",\"" + average.toFixed(2)
                         + "\",\"" + max
                         + "\",\"" + min
                         + "\",\"" + storage.toFixed(2)
                         + "\"";

                    /*
                    for (web in resultsByAddress[address]) {
                        let rate = resultsByAddress[address][web];
                        table += "<th>" + rate + "</th>";
                    }
                    */

                    /* Update Totals */
                    totalDevice = totalDevice === "" ? device : (totalDevice === device ? device : "mixed");
                    totalAverage += average;
                    totalMax += max;
                    totalMin += min;
                    totalStorage += storage;
                }

                /* If multiple servers were examined */
                if (Object.keys(resultsByAddress).length > 1) {

                    /* Update Table Totals */
                    table += "<tr>"
                        + "<th>" + "Total" + "</th>"
                        + "<th>" + totalDevice + "</th>"
                        + "<th>" + totalAverage.toFixed(2) + "</th>"
                        + "<th>" + totalMax + "</th>"
                        + "<th>" + totalMin + "</th>"
                        + "<th>" + totalStorage.toFixed(2) + " GB</th>"
                        + "</tr>";

                    /* Update CSV Totals */
                    csv += "\n\"" + "Total"
                        + "\",\"" + totalDevice
                        + "\",\"" + totalAverage.toFixed(2)
                        + "\",\"" + totalMax
                        + "\",\"" + totalMin
                        + "\",\"" + totalStorage.toFixed(2)
                        + "\"";
                }

                /* Finalize Table */
                table += "</tbody></table>";

                function showResultModal() {
                    showModal("success", "We have your results! <i class=\"fas fa-file-download\"></i>", table);
                }
                showResultModal();

                $(".fa-file-download").click(() => {
                    saveCSV(csv).then((file) => {
                        showModal("info", "Congratulations! <button class=\"delete\" onclick=\"hideModal()\"></button>", "Your results have been saved!");
                    }).catch((err, file) => {
                        showModal("warning", "We couldn't export your results to " + file, "You will automatically return to the result page in 15 seconds so you may try again.</br>" + err);

                        setTimeout(() => {
                            showResultModal();
                        }, 15 * 1000);
                    });
                });
            }
        }).catch((err) => {
            showModal("danger", "We've run into a problem with " + args.username + "@" + address, "Please diagnose the problem before restarting the app and collecting samples again. <br/>" + err);

            /*
            setTimeout(() => {
                showProgressModal();
            }, 60 * 1000);
            */
        });
    });
}

function openCSV() {
    return new Promise(((resolve, reject) => {
        let options = {
            title: "Import CSV",
            defaultPath: "LPS.csv",
            filters: [
                {name: "CSV", extensions: ["csv"]},
                {name: "All Files", extensions: ["*"]}
            ],
            properties: [
                "openFile",
                "multiSelections"
            ]
        };
        remote.dialog.showOpenDialog(options, (files) => {
            if (files !== undefined) {
                let remaining = files.length;
                let result = [];

                for (let key in files) {
                    let file = files[key];

                    fs.readFile(file, (err, data) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        result.push(data.toString());
                        remaining--;

                        if (remaining === 0) {
                            resolve(result);
                            return;
                        }
                    });
                }
            }
        });
    }));
}

function saveCSV(csv) {
    return new Promise(((resolve, reject) => {
        let options = {
            title: "Export CSV",
            defaultPath: "LPS.csv",
            filters: [
                {name: "CSV", extensions: ["csv"]},
                {name: "All Files", extensions: ["*"]}
            ]
        };
        remote.dialog.showSaveDialog(options, (file) => {
            if (file !== undefined) {
                fs.writeFile(file, csv, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(file);
                });
            }
        });
    }));
}

function showModal(type, header, body) {
    $(".modal .message").removeClass().addClass("message is-" + type);
    $(".modal .message-header").html(header);
    $(".modal .message-body").html(body);
    $(".modal").addClass("is-active");
}

function hideModal() {
    $(".modal").removeClass("is-active");
}

function updateReady() {
    if (!checkParameters() || $(".address").length === 0) {
        $(".ready").attr("disabled", "disabled");
    } else $(".ready").removeAttr("disabled");
}

function hasHost(address) {
    return $(".address[name=\"" + address + "\"]").length !== 0;
}

function splitHosts(addresses) {
    if (!REGEX_ADDRESS.test(addresses)) return null;

    let array = addresses.includes(",") ? addresses.split(",") : [addresses];
    let unique = [];
    for (let index in array) {
        let address = array[index];
        if (!unique.includes(address)) {
            unique.push(address);
        }
    }
    return unique;
}

function addHosts(addresses) {
    let array = addresses.includes(",") ? addresses.split(",") : [addresses];
    let duplicates = [];
    for (let index in array) {
        let address = array[index];
        if (!addHost(address) && !duplicates.includes(address)) {
            duplicates.push(address);
        }
    }
    if (duplicates.length !== 0) {
        let remaining = duplicates[0];
        for (let index = 1; index < duplicates.length; index++) {
            remaining += ", " + duplicates[index];
        }
        reject("address");
        return remaining;
    }
    return "";
}

function addHost(address) {
    let exists = !hasHost(address);
    if (exists) {
        $(".addresses").append(
            "<div class=\"address notification is-info\" name=\"" + address + "\">" +
            "<button class=\"delete\" onclick=\"deleteHost('" + address + "')\"></button>" +
            address +
            "</div>"
        );
    }
    updateReady();
    return exists;
}

function deleteHost(address) {
    $(".address[name=\"" + address + "\"]").each((index, element) => {
        $(element).remove();
    });
    updateReady();
}

function reject(name) {
    if (parameters.hasOwnProperty(name)) parameters[name]["ready"] = false;
    if (!$("input[name=" + name + "]").hasClass("is-danger")) {
        $("input[name=" + name + "]").addClass("is-danger");
    }
    updateReady();
}

function ready(name) {
    if (parameters.hasOwnProperty(name)) parameters[name]["ready"] = true;
    if ($("input[name=" + name + "]").hasClass("is-danger")) {
        $("input[name=" + name + "]").removeClass("is-danger");
    }
    updateReady();
}

/* Ready or reject input when any key is pressed while focus is on the text field with the specified name. */
function registerFormValidation(parameters) {
    for (let name in parameters) {
        let regex = parameters[name]["regex"];
        $("input[name=" + name + "]").on("keyup", () => {
            let text = $("input[name=" + name + "]").val().replace(REGEX_SPACE_CHARACTERS, "");
            if (regex.test(text)) {
                ready(name);
            } else reject(name);
        });
    }
}

/* Ready or reject input when enter key is pressed, while focus is on the text field with the specified name, and execute callback if input matches regular expression. */
function registerEnterKeyFormValidation(name, regex, callback) {
    $("input[name=" + name + "]").on("keydown", (e) => {
        if (e.which === 13) {
            let text = $("input[name=" + name + "]").val().replace(REGEX_SPACE_CHARACTERS, "");
            if (regex.test(text)) {
                callback(text);
            } else reject(name);
            return false;
        } else ready(name);
    });
}

$(document).ready(() => {
    /* Load the default values into the parameters map and setup other default parameter fields. */
    setupParameters();

    /* Listen for the enter key to be pressed on the address field and, if it matches the regular expression, add the host to the list and clear out the address field. */
    registerEnterKeyFormValidation("address", REGEX_ADDRESS, (text) => $("input[name=address]").val(addHosts(text)));

    /* Listen for changes to the input fields and respond by updating their ready state in the parameters map and showing a visual response to the user based on whether or not the current input matches its regular expression. */
    registerFormValidation(parameters);
});