/*let setVideo = function(url) {
  video.loop = true;
  video.autoplay = true;
  video.muted = true;
  video.crossOrigin = 'anomymous';
  video.setAttribute('webkit-playsinline', '');
  video.src = url;
  var btn = document.createElement("BUTTON");
  var t = document.createTextNode("CLICK ME");
  btn.style.position = "absolute";
  btn.style.zIndex = "999";
  btn.style.left = "80";
  btn.onclick = function() {
    video.play();
  }
  btn.appendChild(t);
  document.body.appendChild(btn);
}*/

export async function onAnimationFrame(url, video, canvas) {
  await setVideo(url, video);
  //const frame = await init(canvas, video);

  return init(canvas, video);
}

export async function setVideo(url, video) {
  video.loop = true;
  video.autoplay = true;
  video.muted = true;
  video.crossOrigin = 'anonymous';
  video.setAttribute('webkit-playsinline', '');
  video.src = url;
  var btn = document.createElement("BUTTON");
  var t = document.createTextNode("CLICK ME");
  btn.style.position = "absolute";
  btn.style.zIndex = "999";
  btn.style.left = "80";
  btn.onclick = function() {
    video.play();
  }
  btn.appendChild(t);
  document.body.appendChild(btn);
}

export async function init(canvas, video) {
    const stats = new Stats();
    stats.showPanel(0);  // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);

    const vertexShaderGLSL = `#version 450
       layout(location = 0) in vec3 position;
       layout(location = 1) in vec2 uv;

       layout(location = 0) out vec2 fragUV;

      void main() {
          gl_Position = vec4(position, 1.0);
          fragUV = uv;
      }
    `;

    const fragmentShaderGLSL = `#version 450
      layout(set = 0, binding = 0) uniform sampler mySampler;
      layout(set = 0, binding = 1) uniform texture2D myTexture;

      layout(location = 0) in vec2 fragUV;
      layout(location = 0) out vec4 outColor;

      void main() {
          outColor = texture(sampler2D(myTexture, mySampler), fragUV);
          //outColor = vec4(1.0, 0.0, 0.0, 1.0);
      }
    `;
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const glslangModule = await import(/* webpackIgnore: true */ 'https://unpkg.com/@webgpu/glslang@0.0.15/dist/web-devel/glslang.js');
    const glslang = await glslangModule.default();
    const context = canvas.getContext('gpupresent');

    const swapChainFormat = "bgra8unorm";

    var rectVerts = new Float32Array([
        1.0,  1.0, 0.0, 1.0, 0.0,
        1.0, -1.0, 0.0, 1.0, 1.0,
        -1.0, -1.0, 0.0, 0.0, 1.0,
        1.0,  1.0, 0.0, 1.0, 0.0,
        -1.0, -1.0, 0.0, 0.0, 1.0,
        -1.0,  1.0, 0.0, 0.0, 0.0,
    ]);
    const [verticesBuffer, vertexMapping] = device.createBufferMapped({
        size: rectVerts.byteLength,
        usage: GPUBufferUsage.VERTEX
      });
      new Float32Array(vertexMapping).set(rectVerts);
      verticesBuffer.unmap();

      const bindGroupLayout = device.createBindGroupLayout({
        entries: [{
          // Sampler
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          type: "sampler"
        }, {
          // Texture view
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          type: "sampled-texture"
        }]
      });
    // @ts-ignore:
    const swapChain = context.configureSwapChain({
      device,
      format: swapChainFormat,
    });

    const pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),

      vertexStage: {
        module: device.createShaderModule({
          code: glslang.compileGLSL(vertexShaderGLSL, "vertex"),

          // @ts-ignore
          source: vertexShaderGLSL,
          transform: source => glslang.compileGLSL(source, "vertex"),
        }),
        entryPoint: "main"
      },
      fragmentStage: {
        module: device.createShaderModule({
          code: glslang.compileGLSL(fragmentShaderGLSL, "fragment"),

          // @ts-ignore
          source: fragmentShaderGLSL,
          transform: source => glslang.compileGLSL(source, "fragment"),
        }),
        entryPoint: "main"
      },

      primitiveTopology: "triangle-list",
      vertexState: {
        vertexBuffers: [{
          arrayStride: 20,
          attributes: [{
            // position
            shaderLocation: 0,
            offset: 0,
            format: "float3"
          }, {
            // uv
            shaderLocation: 1,
            offset: 12,
            format: "float2"
          }]
        }],
      },

      colorStates: [{
        format: swapChainFormat,
      }],
    });
    
    var videoTexture;

    const sampler = device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });
  
    var uniformBindGroup;
    
    var initialized = false;

    //var total_frame = 5000;

  //const videoTexture = await createTextureFromImage(device, 'assets/img/Di-3d.png', GPUTextureUsage.SAMPLED);

  async function frame(interCanvas, interCanvasContext) {
    stats.begin();
      if (!initialized) {
        videoTexture =  device.createTexture({
          size: {
            width: video.videoWidth,
            height: video.videoHeight,
            depth: 1,
          },
          format: 'rgba8unorm',
          usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.SAMPLED,
        });

        uniformBindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [{
            binding: 0,
            resource: sampler,
          }, {
            binding: 1,
            resource: videoTexture.createView(),
          }],
        });
        initialized = true;
      }
      const commandEncoder = device.createCommandEncoder({});
      const textureView = swapChain.getCurrentTexture().createView();


       /*interCanvasContext.drawImage(
       video, 0, 0, video.videoWidth, video.videoHeight);
         const videoImageBitmap = await createImageBitmap(interCanvas);*/
      //const videoImageBitmap = await createImageBitmap(interCanvas, {imageOrientation: 'flipY'});
      //const videoImageBitmap = await createImageBitmap(video, {imageOrientation: "flipY"});
       const videoImageBitmap = await createImageBitmap(video);

      device.defaultQueue.copyImageBitmapToTexture(
        {imageBitmap:videoImageBitmap, origin: {x:0, y: 0} },
        {texture: videoTexture},
        {width: video.videoWidth, height:video.videoHeight, depth: 1}
      );

      const renderPassDescriptor = {
        colorAttachments: [{
          attachment: textureView,
          loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        }],
      };

      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setPipeline(pipeline);
      passEncoder.setVertexBuffer(0, verticesBuffer);
      passEncoder.setBindGroup(0, uniformBindGroup);
      passEncoder.draw(6, 1, 0, 0);
      passEncoder.endPass();

      device.defaultQueue.submit([commandEncoder.finish()]);
      stats.end();
      //total_frame--;
      //if (total_frame > 0) {
          requestAnimationFrame(function() {frame(interCanvas, interCanvasContext)});
      //}
    }

    return frame;
}