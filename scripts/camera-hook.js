"use strict";

var hookNativeFunc = function hookNativeFunc(funcName, func, tHis, callback) {
  // console.log('Adding hook to ' + funcName);
  tHis[funcName] = function () {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    console.log("".concat(funcName, "(").concat(args, ") hooked!"));
    return callback(func.call.apply(func, [tHis].concat(args)));
  };
};

var hookNativeFuncFuture = function hookNativeFuncFuture(funcName, func, tHis, cbSuccess, cbFailure) {
  // console.log('Adding hook to ' + funcName);
  tHis[funcName] = function () {
    for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    console.log("".concat(funcName, "(").concat(args, ") hooked!"));
    return new Promise(function (resolve, reject) {
      return func.call.apply(func, [tHis].concat(args)).then(function () {
        for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
          args[_key3] = arguments[_key3];
        }

        return cbSuccess.apply(void 0, args.concat([resolve]));
      })["catch"](function () {
        for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
          args[_key4] = arguments[_key4];
        }

        return cbFailure.apply(void 0, args.concat([reject]));
      });
    });
  };
};

var hookDeprectatedGetUserMedia = function hookDeprectatedGetUserMedia(funcName, func, tHis, cbSuccess, cbFailure) {
  // console.log('Adding hook to ' + funcName);
  tHis[funcName] = function (constraints, successCallback, errorCallback) {
    console.log("".concat(funcName, "(constraints, cbSuccess, cbError) hooked!"));
    return func.call(navigator, constraints, function () {
      for (var _len5 = arguments.length, args = new Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
        args[_key5] = arguments[_key5];
      }

      return cbSuccess.apply(void 0, args.concat([successCallback]));
    }, function () {
      for (var _len6 = arguments.length, args = new Array(_len6), _key6 = 0; _key6 < _len6; _key6++) {
        args[_key6] = arguments[_key6];
      }

      return cbFailure.apply(void 0, args.concat([errorCallback]));
    });
  };
}; // window.depsLoaded = false;


var cameraHookSuccess = function cameraHookSuccess(stream, callback) {
  if (loadVirtualBackgroundDependencies() == true) return loadBodyPixNN().then(function () {
    return callback(cloneAndProcessCameraStream(stream));
  });
  setTimeout(function () {
    return cameraHookSuccess(stream, callback);
  }, 500);
};

var cameraHookFailure = function cameraHookFailure(err, callback) {
  return callback(err);
}; // cross browser compatiblity


if (!!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia) hookNativeFuncFuture('getUserMedia', navigator.mediaDevices.getUserMedia, navigator.mediaDevices, cameraHookSuccess, cameraHookFailure);
if (!!navigator.webkitGetUserMedia) hookDeprectatedGetUserMedia('webkitGetUserMedia', navigator.webkitGetUserMedia, navigator, cameraHookSuccess, cameraHookFailure);
if (!!navigator.mozGetUserMedia) hookDeprectatedGetUserMedia('mozGetUserMedia', navigator.mozGetUserMedia, navigator, cameraHookSuccess, cameraHookFailure);
if (!!navigator.msGetUserMedia) hookDeprectatedGetUserMedia('msGetUserMedia', navigator.msGetUserMedia, navigator, cameraHookSuccess, cameraHookFailure);