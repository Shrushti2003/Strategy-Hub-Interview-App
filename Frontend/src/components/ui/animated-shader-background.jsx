"use client";

import { useEffect, useRef } from "react";

const VERTEX_SHADER_SOURCE = `
    attribute vec2 position;
    varying vec2 v_texCoord;
    void main() {
      v_texCoord = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

const FRAGMENT_SHADER_SOURCE = `
    precision highp float;

    varying vec2 v_texCoord;
    uniform float u_time;
    uniform vec2 u_resolution;

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
        vec2 uv = v_texCoord;
        // Correct aspect ratio
        float aspect = u_resolution.x / u_resolution.y;
        uv.x *= aspect;
        
        // Rotate coordinates for diagonal movement (approx 45 degrees)
        float angle = 0.785; // 45 degrees
        mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        vec2 rot_uv = rot * uv;
        
        // Grid system for meteors
        vec2 grid = vec2(15.0, 1.0);
        vec2 st = rot_uv * grid;
        vec2 ipos = floor(st);
        vec2 fpos = fract(st);
        
        // Individual meteor timing and properties
        float rnd = random(ipos);
        float speed = 0.5 + rnd * 1.5;
        float time = u_time * speed + rnd * 10.0;
        
        // Trail calculation
        float pos = mod(time, 2.0) - 0.5;
        float trail = smoothstep(pos - 0.6, pos, fpos.y) * (1.0 - smoothstep(pos, pos + 0.02, fpos.y));
        
        // Thinning the meteors
        float line = smoothstep(0.48, 0.5, fpos.x) * (1.0 - smoothstep(0.5, 0.52, fpos.x));
        float alpha = trail * line * step(0.7, rnd); // random density
        
        // Color cycle: dark purple, dark blue, cyan, green
        vec3 c1 = vec3(0.3, 0.0, 0.5); // Dark Purple
        vec3 c2 = vec3(0.0, 0.0, 0.4); // Dark Blue
        vec3 c3 = vec3(0.0, 1.0, 1.0); // Cyan
        vec3 c4 = vec3(0.0, 0.8, 0.2); // Green
        
        float color_mix = mod(time * 0.2 + rnd, 4.0);
        vec3 color;
        if (color_mix < 1.0) color = mix(c1, c2, fract(color_mix));
        else if (color_mix < 2.0) color = mix(c2, c3, fract(color_mix));
        else if (color_mix < 3.0) color = mix(c3, c4, fract(color_mix));
        else color = mix(c4, c1, fract(color_mix));
        
        gl_FragColor = vec4(color * alpha * 2.0, alpha);
    }
  `;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

const AnoAI = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");

    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const timeLocation = gl.getUniformLocation(program, "u_time");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    window.addEventListener("resize", resize);
    resize();

    let frameId;
    function render(time) {
      time *= 0.001; // Convert to seconds

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1f(timeLocation, time);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frameId = requestAnimationFrame(render);
    }

    frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-screen w-screen overflow-hidden bg-black"
      data-purpose="animation-container"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        data-purpose="webgl-meteor-shower"
        id="meteor-canvas"
      />
    </div>
  );
};

export default AnoAI;
