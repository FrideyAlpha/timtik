"use strict";

/********************
 * global + constants
 ********************/
window.depsLoaded = false;
var FPS = 30; // 30 fps == 🔥

var DEBUG = false; // BodyPix NN settings

var bodyPixOpts = {
  architecture: 'MobileNetV1',
  outputStride: 16,
  multiplier: 0.75,
  quantBytes: 2 // outputStride: 8,
  // multiplier: 1,
  // quantBytes: 4

};


var segmentationOpts = {
  internalResolution: 'medium',
  segmentationThreshold: 0.80,
  maxDetections: 5
};
var bodyPixNN = null;
var backgroundImg = null;
/******************
 * deps and loading
 ******************/

var loadVirtualBackgroundDependencies = function loadVirtualBackgroundDependencies() {
  if (!!window.depsLoaded && window.depsLoaded === true) return true; // ask content_script injector.js to load some scripts

  var event = new Event('loadDeps');
  document.dispatchEvent(event);
  return false;
};

var loadBodyPixNN = function loadBodyPixNN() {
  if (bodyPixNN != null) return Promise.resolve();
  return window.bodyPix.load(bodyPixOpts).then(function (net) {
    bodyPixNN = net;
    console.log('BodyPix model ready');
  });
};
/*********************
 * Canvas manipulation
 *********************/


var imageToImageData = function imageToImageData(image, w, h) {
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(image, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
};

var imageDataToCanvas = function imageDataToCanvas(imageData, w, h) {
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  canvas.width = w;
  canvas.height = h;
  ctx.clearRect(0, 0, w, h);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

var imageToCanvas = function imageToCanvas(image, w, h) {
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  canvas.width = w;
  canvas.height = h;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(image, 0, 0, w, h);
  return canvas;
};
/*****************************
 * Image processing start here
 *****************************/


var opencvMatrixToCanvas = function opencvMatrixToCanvas(mat, canvasCtx) {
  var imageData = imageDataToCanvas(new ImageData(new Uint8ClampedArray(mat.data), mat.cols, mat.rows), mat.cols, mat.rows);
  canvasCtx.drawImage(imageData, 0, 0, mat.cols, mat.rows);
};

var detectBodies = function detectBodies(frame) {
  var imageData = imageToImageData(frame, frame.width, frame.height);
  return bodyPixNN.segmentPerson(imageData, segmentationOpts).then(function (segmentation) {
    if (segmentation.allPoses.length == 0) return null;
    return segmentation.data; // this is a mask: each pixel is noted 0 or 1 depending it is body part or not
  });
};

var processVirtualBackground = function processVirtualBackground(camera, canvas, ctx, width, height) {
  var requestNextFrame = function requestNextFrame() {
    // we add a very small delay, in order to calm down the CPU ;)
    setTimeout(function () {
      processVirtualBackground(camera, canvas, ctx, width, height);
    }, 200);
  };

  if (DEBUG == false && (backgroundImg == null || backgroundImg.src == null || backgroundImg.src == '' || backgroundImg.complete == false)) {
    ctx.drawImage(camera, 0, 0, width, height);
    requestNextFrame();
    return;
  }

  var frame = imageToCanvas(camera, width, height);
  detectBodies(frame).then(function (mask) {
    // nobody detected
    if (mask == null) {
      if (DEBUG == true) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.drawImage(backgroundImg, 0, 0, width, height);
      }

      return;
    } // at least 1 body detected


    var maskMat = new cv.matFromArray(height, width, cv.CV_8UC1, mask);

    if (DEBUG == true) {
      // show black and white mask
      var maskMa32Mono = new cv.Mat();
      var maskMat32RGBA = new cv.Mat();
      cv.threshold(maskMat, maskMa32Mono, 0, 255, cv.THRESH_BINARY);
      cv.cvtColor(maskMa32Mono, maskMat32RGBA, cv.COLOR_GRAY2RGBA);
      opencvMatrixToCanvas(maskMat32RGBA, ctx);
      maskMa32Mono["delete"]();
      maskMat32RGBA["delete"]();
    } else {
      // show background + bodies
      var frameMat = cv.imread(frame);
      var destMat = cv.imread(imageToCanvas(backgroundImg, width, height));
      frameMat.copyTo(destMat, maskMat);
      opencvMatrixToCanvas(destMat, ctx);
      frameMat["delete"]();
      destMat["delete"]();
    }

    maskMat["delete"]();
  })["finally"](function () {
    requestNextFrame();
  });
};

var cloneAndProcessCameraStream = function cloneAndProcessCameraStream(stream) {
  var videoTracks = stream.getVideoTracks();

  if (videoTracks.length == 0) {
    console.warn('No video track detected');
    return stream;
  }

  var videoTrack = videoTracks[0];
  var width = videoTrack.getSettings().width;
  var height = videoTrack.getSettings().height; // process frames will be streamed into this canvas
  // this canvas will be exported by `captureStream`

  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height; //  original stream is send to a video element

  var video = document.createElement('video');
  video.width = stream.width;
  video.height = stream.height;
  video.muted = true;
  video.srcObject = stream;
  video.play();
  processVirtualBackground(video, canvas, ctx, width, height);
  var outputStream = canvas.captureStream(FPS);

  outputStream.getAudioTracks = function () {
    return stream.getAudioTracks();
  };

  return outputStream;
};

setInterval(function () {
  if (document.querySelectorAll('.toolbox-content .button-group-center').length == 0) return;
  if (document.querySelectorAll('#refined-camera-bg-upload').length != 0) return;
  addUploadButton();
}, 1000);

function insertBefore(el, parent) {
  parent.appendChild(el);
}

function addUploadButton() {
  // should be moved to a css file ;)
  var styleWrapper = "\n    color: #FFF;\n    cursor: pointer;\n    display: inline-block;\n    line-height: 38px;\n    margin: 0 8px;\n    text-align: center;\n  ";
  var styleInput = "\n    width: 0.1px;\n    height: 0.1px;\n    opacity: 0;\n    overflow: hidden;\n    position: absolute;\n    z-index: -1;\n  ";
  var styleLabel = "\n    background-color: #fff;\n    border-radius: 20px;\n    border: 1px solid #d1dbe8;\n    margin: 0 4px;\n    height: 38px;\n    color: #5e6d7a;\n    padding: 0 15px;\n    font-size: 13px;\n    cursor: pointer;\n    display: block;\n  ";
  var cancelIcon = "\n  <svg width=\"16\" height=\"16\" viewBox=\"0 0 365.696 365.696\" style=\"margin-left: 10px; vertical-align: text-bottom;\">\n    <path d=\"m243.1875 182.859375 113.132812-113.132813c12.5-12.5 12.5-32.765624 0-45.246093l-15.082031-15.082031c-12.503906-12.503907-32.769531-12.503907-45.25 0l-113.128906 113.128906-113.132813-113.152344c-12.5-12.5-32.765624-12.5-45.246093 0l-15.105469 15.082031c-12.5 12.503907-12.5 32.769531 0 45.25l113.152344 113.152344-113.128906 113.128906c-12.503907 12.503907-12.503907 32.769531 0 45.25l15.082031 15.082031c12.5 12.5 32.765625 12.5 45.246093 0l113.132813-113.132812 113.128906 113.132812c12.503907 12.5 32.769531 12.5 45.25 0l15.082031-15.082031c12.5-12.503906 12.5-32.769531 0-45.25zm0 0\"/>\n  </svg>\n  ";
  var defaultLabelTxt = 'Background';
  var div = document.createElement('div');
  div.id = 'refined-camera-bg-upload';
  div.innerHTML = "\n    <input type=\"file\" id=\"upload-bg\" name=\"upload-bg\" style=\"".concat(styleInput, "\">\n    <label for=\"upload-bg\" for=\"file\" style=\"").concat(styleLabel, "\">").concat(defaultLabelTxt, "</label>\n  ");
  div.style = styleWrapper;
  document.querySelector('.toolbox-content .button-group-center').appendChild(div);
  document.querySelector('#refined-camera-bg-upload input[type=file]').addEventListener('change', function () {
    if (this.files && this.files[0]) {
      var _img = document.createElement('img');

      _img.src = window.URL.createObjectURL(this.files[0]);
      backgroundImg = _img;
      var filename = this.files[0].name;
      document.querySelector('#refined-camera-bg-upload label').innerHTML = filename + cancelIcon;
    }
  });
  document.querySelector('#refined-camera-bg-upload label').addEventListener('click', function (event) {
    if (backgroundImg != null) {
      backgroundImg = null;
      document.querySelector('#refined-camera-bg-upload label').innerHTML = defaultLabelTxt;
      document.querySelector('#refined-camera-bg-upload input[type=file]').value = ''; // this prevent browsing window from opening

      event.preventDefault();
    }
  });
}