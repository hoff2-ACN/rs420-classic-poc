// (c) 2013-2015 Don seria
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* global mainPage, deviceList, refreshButton, statusDiv */
/* global detailPage, resultDiv, messageInput, sendButton, disconnectButton */
/* global readButton */
/* global cordova, bluetoothSerial  */
/* jshint browser: true , devel: true*/
'use strict';

function initializeStateMachine() {
    return new StateMachine({
        init: 'not_reading',
        transitions: [
            {name: 'readTag', from: 'not_reading', to: 'reading'},
            {name: 'gotoStandby', from: 'reading', to: 'not_reading'}
        ],
        methods: {
            onReadTag: function () {
                console.log('Reading...')
                const success = function () {
                    resultDiv.innerHTML = resultDiv.innerHTML + "Reading tag...<br/>";
                    resultDiv.scrollTop = resultDiv.scrollHeight;
                };

                const failure = function () {
                    alert("Unable to send read command.");
                };

                bluetoothSerial.write("read\r\n", success, failure);
            },
            onGotoStandby: function () {
                console.log('Standing by...')
            }
        }
    });
}

var app = {
    initialize: function () {
        this.bindEvents();
        this.showMainPage();
        app.machine = initializeStateMachine();
        console.log("FSM Current State: " + app.machine.state);
    },

    bindEvents: function () {
        var TOUCH_START = 'touchstart';
        if (window.navigator.msPointerEnabled) { // windows phone
            TOUCH_START = 'MSPointerDown';
        }
        document.addEventListener('deviceready', this.onDeviceReady, false);
        refreshButton.addEventListener(TOUCH_START, this.refreshDeviceList, false);
        sendButton.addEventListener(TOUCH_START, this.sendData, false);
        disconnectButton.addEventListener(TOUCH_START, this.disconnect, false);
        deviceList.addEventListener('touchstart', this.connect, false);
        readButton.addEventListener(TOUCH_START, this.handleReadButton, false);
    },

    onDeviceReady: function () {
        app.refreshDeviceList();
    },

    refreshDeviceList: function () {
        bluetoothSerial.list(app.onDeviceList, app.onError);
    },

    onDeviceList: function (devices) {
        var option;

        // remove existing devices
        deviceList.innerHTML = "";
        app.setStatus("");

        devices.forEach(function (device) {

            var listItem = document.createElement('li'),
                html = '<b>' + device.name + '</b><br/>' + device.id;

            listItem.innerHTML = html;

            if (cordova.platformId === 'windowsphone') {
                // This is a temporary hack until I get the list tap working
                var button = document.createElement('button');
                button.innerHTML = "Connect";
                button.addEventListener('click', app.connect, false);
                button.dataset = {};
                button.dataset.deviceId = device.id;
                listItem.appendChild(button);
            } else {
                listItem.dataset.deviceId = device.id;
            }
            deviceList.appendChild(listItem);
        });

        if (devices.length === 0) {

            option = document.createElement('option');
            option.innerHTML = "No Bluetooth Devices";
            deviceList.appendChild(option);

            if (cordova.platformId === "ios") { // BLE
                app.setStatus("No Bluetooth Peripherals Discovered.");
            } else { // Android or Windows Phone
                app.setStatus("Please Pair a Bluetooth Device.");
            }

        } else {
            app.setStatus("Found " + devices.length + " device" + (devices.length === 1 ? "." : "s."));
        }
    },

    connect: function (e) {
        var onConnect = function () {
            // subscribe for incoming data
            bluetoothSerial.subscribe('\n', app.onData, app.onError);

            resultDiv.innerHTML = "";
            app.setStatus("Connected");
            app.showDetailPage();
        };

        var deviceId = e.target.dataset.deviceId;
        if (!deviceId) { // try the parent
            deviceId = e.target.parentNode.dataset.deviceId;
        }

        bluetoothSerial.connect(deviceId, onConnect, app.onError);
    },

    handleReadButton: function (event) {
        app.machine.readTag();
        app.timeout = setTimeout(() => {
            if (app.machine.state === 'reading') {
                app.machine.gotoStandby()
            }
        }, 11000);
    },

    onData: function (data) { // data received from Arduino
        const strippedData = data.trim();

        console.log(strippedData);

        const display = function(message) {
            resultDiv.innerHTML = resultDiv.innerHTML + "Received: " + message + "<br/>";
            resultDiv.scrollTop = resultDiv.scrollHeight;
        };

        const displayTag = function(tag) {
            resultDiv.innerHTML = resultDiv.innerHTML + "Read Ear Tag: " + tag + "<br/>";
            resultDiv.scrollTop = resultDiv.scrollHeight;
        };

        display(strippedData);

        switch(app.machine.state) {
            case "reading":
                if (strippedData !== 'read' && strippedData !== 'OK') {
                    clearTimeout(app.timeout);
                    displayTag(data);
                    app.machine.gotoStandby();
                }
                break;
            default:
                break;
        }
    },
    sendData: function (event) { // send data to Arduino

        var success = function () {
            console.log("success");
            resultDiv.innerHTML = resultDiv.innerHTML + "Sent: " + messageInput.value + "<br/>";
            resultDiv.scrollTop = resultDiv.scrollHeight;
        };

        var failure = function () {
            alert("Failed writing data to Bluetooth peripheral");
        };

        var data = messageInput.value;
        bluetoothSerial.write(data + "\r\n", success, failure);
    },
    disconnect: function (event) {
        bluetoothSerial.disconnect(app.showMainPage, app.onError);
    },
    showMainPage: function () {
        mainPage.style.display = "";
        detailPage.style.display = "none";
    },
    showDetailPage: function () {
        mainPage.style.display = "none";
        detailPage.style.display = "";
    },
    setStatus: function (message) {
        console.log(message);

        window.clearTimeout(app.statusTimeout);
        statusDiv.innerHTML = message;
        statusDiv.className = 'fadein';

        // automatically clear the status with a timer
        app.statusTimeout = setTimeout(function () {
            statusDiv.className = 'fadeout';
        }, 5000);
    },
    onError: function (reason) {
        alert("ERROR: " + reason); // real apps should use notification.alert
    }
};
