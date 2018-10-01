let $ = require("jquery");
let { remote } = require("electron");

$(document).ready(() => {
    $(".delete").click(() => {
        remote.getCurrentWindow().close();
    });
});