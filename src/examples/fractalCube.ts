import { mat4, vec3 } from 'gl-matrix';
import { cubeVertexArray, cubeVertexSize, cubeColorOffset, cubeUVOffset, cubePositionOffset } from '../cube';
import glslangModule from '../glslang';

export const title = 'Fractal Cube';
export const description = 'This example uses the previous frame\'s rendering result \
              as the source texture for the next frame.';

export async function init(canvas: HTMLCanvasElement) {

  const vertexShaderGLSL = `#version 450
  layout(set = 0, binding = 0) uniform Uniforms {
    mat4 modelViewProjectionMatrix;
  } uniforms;

  layout(location = 0) in vec4 position;
  layout(location = 1) in vec4 color;
  layout(location = 2) in vec2 uv;

  layout(location = 0) out vec4 fragColor;
  layout(location = 1) out vec2 fragUV;

  void main() {
    gl_Position = uniforms.modelViewProjectionMatrix * position;
    fragColor = color;
    fragUV = uv;
  }`;

  const fragmentShaderGLSL = `#version 450
  layout(set = 0, binding = 1) uniform sampler mySampler;
  layout(set = 0, binding = 2) uniform texture2D myTexture;

  layout(location = 0) in vec4 fragColor;
  layout(location = 1) in vec2 fragUV;
  layout(location = 0) out vec4 outColor;

  void main() {
    vec4 texColor = texture(sampler2D(myTexture, mySampler), fragUV * 0.8 + 0.1);

    // 1.0 if we're sampling the background
    float f = float(length(texColor.rgb - vec3(0.5, 0.5, 0.5)) < 0.01);

    outColor = mix(texColor, fragColor, f);
  }`;

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const glslang = await glslangModule();

  const aspect = Math.abs(canvas.width / canvas.height);
  let projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, aspect, 1, 100.0);

  const context = canvas.getContext('gpupresent');

  // @ts-ignore:
  const swapChain = context.configureSwapChain({
    device,
    format: "bgra8unorm",
    usage: GPUTextureUsage.OUTPUT_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  const verticesBuffer = device.createBuffer({
    size: cubeVertexArray.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(verticesBuffer.getMappedRange()).set(cubeVertexArray);
  verticesBuffer.unmap();

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{
      // Transform
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      type: "uniform-buffer"
    }, {
      // Sampler
      binding: 1,
      visibility: GPUShaderStage.FRAGMENT,
      type: "sampler"
    }, {
      // Texture view
      binding: 2,
      visibility: GPUShaderStage.FRAGMENT,
      type: "sampled-texture"
    }]
  });

  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,

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
    depthStencilState: {
      depthWriteEnabled: true,
      depthCompare: "less",
      format: "depth24plus-stencil8",
    },
    vertexState: {
      vertexBuffers: [{
        arrayStride: cubeVertexSize,
        attributes: [{
          // position
          shaderLocation: 0,
          offset: cubePositionOffset,
          format: "float4"
        }, {
          // color
          shaderLocation: 1,
          offset: cubeColorOffset,
          format: "float4"
        }, {
          // uv
          shaderLocation: 2,
          offset: cubeUVOffset,
          format: "float2"
        }]
      }],
    },

    rasterizationState: {
      cullMode: 'back',
    },

    colorStates: [{
      format: "bgra8unorm",
    }],
  });

  const depthTexture = device.createTexture({
    size: { width: canvas.width, height: canvas.height, depth: 1 },
    format: "depth24plus-stencil8",
    usage: GPUTextureUsage.OUTPUT_ATTACHMENT
  });

  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [{
      attachment: undefined, // Attachment is set later
      loadValue: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
    }],
    depthStencilAttachment: {
      attachment: depthTexture.createView(),

      depthLoadValue: 1.0,
      depthStoreOp: "store",
      stencilLoadValue: 0,
      stencilStoreOp: "store",
    }
  };

  const uniformBufferSize = 4 * 16; // 4x4 matrix
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const cubeTexture = device.createTexture({
    size: { width: canvas.width, height: canvas.height, depth: 1 },
    format: "bgra8unorm",
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.SAMPLED,
  });

  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
  });

  const uniformBindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{
      binding: 0,
      resource: {
        buffer: uniformBuffer,
      },
    }, {
      binding: 1,
      resource: sampler,
    }, {
      binding: 2,
      resource: cubeTexture.createView(),
    }],
  });

  function getTransformationMatrix() {
    let viewMatrix = mat4.create();
    mat4.translate(viewMatrix, viewMatrix, vec3.fromValues(0, 0, -4));
    let now = Date.now() / 1000;
    mat4.rotate(viewMatrix, viewMatrix, 1, vec3.fromValues(Math.sin(now), Math.cos(now), 0));

    let modelViewProjectionMatrix = mat4.create();
    mat4.multiply(modelViewProjectionMatrix, projectionMatrix, viewMatrix);

    return modelViewProjectionMatrix as Float32Array;
  }

  return function frame() {
    const transformationMatrix = getTransformationMatrix();
    device.defaultQueue.writeBuffer(
      uniformBuffer,
      0,
      transformationMatrix.buffer,
      transformationMatrix.byteOffset,
      transformationMatrix.byteLength
    );

    const swapChainTexture = swapChain.getCurrentTexture();
    renderPassDescriptor.colorAttachments[0].attachment = swapChainTexture.createView();

    const commandEncoder = device.createCommandEncoder();

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.setVertexBuffer(0, verticesBuffer);
    passEncoder.draw(36, 1, 0, 0);
    passEncoder.endPass();

    commandEncoder.copyTextureToTexture({
      texture: swapChainTexture,
    }, {
      texture: cubeTexture,
    }, {
      width: canvas.width,
      height: canvas.height,
      depth: 1,
    });

    device.defaultQueue.submit([commandEncoder.finish()]);
  }
}
