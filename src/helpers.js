"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.updateBufferData = exports.createTextureFromImage = exports.checkWebGPUSupport = void 0;
var displayedNotSupportedError = false;
function checkWebGPUSupport() {
    if (!navigator.gpu) {
        document.getElementById('not-supported').style.display = 'block';
        if (!displayedNotSupportedError) {
            alert('WebGPU not supported! Please visit webgpu.io to see the current implementation status.');
        }
        displayedNotSupportedError = true;
    }
    return !!navigator.gpu;
}
exports.checkWebGPUSupport = checkWebGPUSupport;
function createTextureFromImage(device, src, usage) {
    return __awaiter(this, void 0, void 0, function () {
        var img, imageCanvas, imageCanvasContext, imageData, data, bytesPerRow, imagePixelIndex, y, x, i, texture, _a, textureDataBuffer, mapping, commandEncoder;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    img = document.createElement('img');
                    img.src = src;
                    return [4 /*yield*/, img.decode()];
                case 1:
                    _b.sent();
                    imageCanvas = document.createElement('canvas');
                    imageCanvas.width = img.width;
                    imageCanvas.height = img.height;
                    imageCanvasContext = imageCanvas.getContext('2d');
                    imageCanvasContext.translate(0, img.height);
                    imageCanvasContext.scale(1, -1);
                    imageCanvasContext.drawImage(img, 0, 0, img.width, img.height);
                    imageData = imageCanvasContext.getImageData(0, 0, img.width, img.height);
                    data = null;
                    bytesPerRow = Math.ceil(img.width * 4 / 256) * 256;
                    if (bytesPerRow == img.width * 4) {
                        data = imageData.data;
                    }
                    else {
                        data = new Uint8Array(bytesPerRow * img.height);
                        imagePixelIndex = 0;
                        for (y = 0; y < img.height; ++y) {
                            for (x = 0; x < img.width; ++x) {
                                i = x * 4 + y * bytesPerRow;
                                data[i] = imageData.data[imagePixelIndex];
                                data[i + 1] = imageData.data[imagePixelIndex + 1];
                                data[i + 2] = imageData.data[imagePixelIndex + 2];
                                data[i + 3] = imageData.data[imagePixelIndex + 3];
                                imagePixelIndex += 4;
                            }
                        }
                    }
                    texture = device.createTexture({
                        size: {
                            width: img.width,
                            height: img.height,
                            depth: 1
                        },
                        format: "rgba8unorm",
                        usage: GPUTextureUsage.COPY_DST | usage
                    });
                    _a = device.createBufferMapped({
                        size: data.byteLength,
                        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
                    }), textureDataBuffer = _a[0], mapping = _a[1];
                    new Uint8Array(mapping).set(data);
                    textureDataBuffer.unmap();
                    commandEncoder = device.createCommandEncoder({});
                    commandEncoder.copyBufferToTexture({
                        buffer: textureDataBuffer,
                        bytesPerRow: bytesPerRow
                    }, {
                        texture: texture
                    }, {
                        width: img.width,
                        height: img.height,
                        depth: 1
                    });
                    device.defaultQueue.submit([commandEncoder.finish()]);
                    textureDataBuffer.destroy();
                    return [2 /*return*/, texture];
            }
        });
    });
}
exports.createTextureFromImage = createTextureFromImage;
function updateBufferData(device, dst, dstOffset, src, commandEncoder) {
    var _a = device.createBufferMapped({
        size: src.byteLength,
        usage: GPUBufferUsage.COPY_SRC
    }), uploadBuffer = _a[0], mapping = _a[1];
    // @ts-ignore
    new src.constructor(mapping).set(src);
    uploadBuffer.unmap();
    commandEncoder = commandEncoder || device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(uploadBuffer, 0, dst, dstOffset, src.byteLength);
    return { commandEncoder: commandEncoder, uploadBuffer: uploadBuffer };
}
exports.updateBufferData = updateBufferData;
