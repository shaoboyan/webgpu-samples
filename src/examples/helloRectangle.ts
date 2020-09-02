import glslangModule from '../glslang';

export const title = 'Hello Triangle';
export const description = 'Shows rendering a basic triangle.';

function createSPIRVModule(device: GPUDevice, glslang, stage: string, glsl: string) : GPUShaderModule {
    return device.createShaderModule({
      code: glslang.compileGLSL(glsl, stage),

      // @ts-ignore
      source: glsl,
      transform: source => glslang.compileGLSL(source, stage),
    })
}

function createWGSLModule(device: GPUDevice, wgsl: string) : GPUShaderModule {
    return device.createShaderModule({
      code: wgsl,

      // @ts-ignore
      source: wgsl,
      transform: source => source,
    })
}

export async function init(canvas: HTMLCanvasElement) {
    const vertexShaderGLSL = `#version 450
      layout(location = 0) in vec3 pos;
      layout(location = 1) in vec2 uv;
      
      void main() {
        gl_Position = vec4(pos, 1.0);
      }
    `;

    const vertexShaderWGSL = `
      [[location 0]] var<in> pos : vec3<f32>;
      [[location 1]] var<in> uv : vec2<f32>;

      [[builtin position]] var<out> Position : vec4<f32>;
      
      fn vtx_main() -> void {
        Position = vec4<f32>(pos, 1.0);
        return;
      }

      entry_point vertex as "main" = vtx_main;
    `;

    const fragmentShaderGLSL = `#version 450
      layout(location = 0) out vec4 outColor;

      void main() {
          outColor = vec4(1.0, 0.0, 0.0, 1.0);
      }
    `;

    const fragmentShaderWGSL = `
      [[location 0]] var<out> outColor : vec4<f32>;
      fn frag_main() -> void {
        outColor = vec4<f32>(1.0, 0.0, 0.0, 1.0);
        return;
      }
      entry_point fragment as "main" = frag_main;
    `;

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const glslang = await glslangModule();
    const useWGSL = new URLSearchParams(window.location.search).get("wgsl") != "0";

    const context = canvas.getContext('gpupresent');

    const swapChainFormat = "bgra8unorm";

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

    // @ts-ignore:
    const swapChain: GPUSwapChain = context.configureSwapChain({
      device,
      format: swapChainFormat,
    });

    const pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [] }),

      vertexStage: {
        module: useWGSL ? createWGSLModule(device, vertexShaderWGSL)
                        : createSPIRVModule(device, glslang, "vertex", vertexShaderGLSL),
        entryPoint: "main"
      },
      fragmentStage: {
        module: useWGSL ? createWGSLModule(device, fragmentShaderWGSL)
                        : createSPIRVModule(device, glslang, "fragment", fragmentShaderGLSL),
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

    function frame() {
      const commandEncoder = device.createCommandEncoder({});
      const textureView = swapChain.getCurrentTexture().createView();

      const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [{
          attachment: textureView,
          loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        }],
      };

      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setPipeline(pipeline);
      passEncoder.setVertexBuffer(0, verticesBuffer);
      passEncoder.draw(6, 1, 0, 0);
      passEncoder.endPass();

      device.defaultQueue.submit([commandEncoder.finish()]);
    }

    return frame;
}
