import glslangModule from '../glslang';
import { createTextureFromImage } from '../helpers';

export const title = 'Hello Triangle';
export const description = 'Shows rendering a basic triangle.';

export async function init(canvas: HTMLCanvasElement, useWGSL: boolean) {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const glslang = await glslangModule();

  const context = canvas.getContext("gpupresent");

  const swapChainFormat = "bgra8unorm";

  const swapChain = context.configureSwapChain({
    device,
    format: swapChainFormat,
  });

  const  rectVerts = new Float32Array([
    1.0, 1.0, 0.0, 1.0, 0.0,
    1.0, -1.0, 0.0, 1.0, 1.0,
    -1.0, -1.0, 0.0, 0.0, 1.0,
    1.0, 1.0, 0.0, 1.0, 0.0,
    -1.0, -1.0, 0.0, 0.0, 1.0,
    -1.0, 1.0, 0.0, 0.0, 0.0,
  ]);
  
  const verticesBuffer = device.createBuffer({
    size: rectVerts.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true
  });
  new Float32Array(verticesBuffer.getMappedRange()).set(rectVerts);
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

  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertexStage: {
      module: useWGSL
        ? device.createShaderModule({
            code: wgslShaders.vertex,
          })
        : device.createShaderModule({
            code: glslShaders.vertex,
            transform: (glsl) => glslang.compileGLSL(glsl, "vertex"),
          }),
      entryPoint: "main",
    },
    fragmentStage: {
      module: useWGSL
        ? device.createShaderModule({
            code: wgslShaders.fragment,
          })
        : device.createShaderModule({
            code: glslShaders.fragment,
            transform: (glsl) => glslang.compileGLSL(glsl, "fragment"),
          }),
      entryPoint: "main",
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

    colorStates: [
      {
        format: swapChainFormat,
      },
    ],
  });

  const rectTexture = await createTextureFromImage(device, 'assets/img/Di-3d.png', GPUTextureUsage.SAMPLED);

  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
  });

  const uniformBindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{
      binding: 0,
      resource: sampler,
    }, {
      binding: 1,
      resource: rectTexture.createView(),
    }],
  });

  function frame() {
    const commandEncoder = device.createCommandEncoder();
    const textureView = swapChain.getCurrentTexture().createView();

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          attachment: textureView,
          loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        },
      ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setVertexBuffer(0, verticesBuffer);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.draw(6, 1, 0, 0);
    passEncoder.endPass();

    device.defaultQueue.submit([commandEncoder.finish()]);
  }

  return frame;
}

export const glslShaders = {
  vertex: `#version 450
  layout(location = 0) in vec3 pos;
  layout(location = 1) in vec2 uv;

  layout(location = 0) out vec2 fragUV;
  
  void main() {
    gl_Position = vec4(pos, 1.0);
    fragUV = uv;
  }
`,

  fragment: `#version 450
  layout(set = 0, binding = 0) uniform sampler mySampler;
  layout(set = 0, binding = 1) uniform texture2D myTexture;

  layout(location = 0) in vec2 fragUV;
  layout(location = 0) out vec4 outColor;

  void main() {
      outColor = texture(sampler2D(myTexture, mySampler), fragUV);
  }
`,
};
//outColor = texture_sample(myTexture, mySampler, fragUV);
export const wgslShaders = {
  vertex:`
  [[location 0]] var<in> pos : vec3<f32>;
  [[location 1]] var<in> uv : vec2<f32>;
  [[location 0]] var<out> fragUV: vec2<f32>;

  [[builtin position]] var<out> Position : vec4<f32>;
  
  fn vtx_main() -> void {
    Position = vec4<f32>(pos, 1.0);
    fragUV = uv;
    return;
  }

  entry_point vertex as "main" = vtx_main;
`,
  fragment:  `
  [[binding 0, set 0]] var<uniform> my_sampler: sampler;
  [[binding 1, set 0]] var<uniform> my_texture: texture_sampled_2d<f32>;

    [[location 0]] var<in> fragUV : vec2<f32>;
    [[location 0]] var<out> outColor : vec4<f32>;
    fn frag_main() -> void {
      outColor = texture_sample(my_texture, my_sampler, fragUV);
      return;
    }
    entry_point fragment as "main" = frag_main;
  `,
};
