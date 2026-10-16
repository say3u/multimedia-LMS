import { useEffect, useRef } from 'react'

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uWaveSpeed;
uniform float uWaveFrequency;
uniform float uWaveAmplitude;
uniform vec3  uWaveColor;
uniform float uColorNum;

out vec4 fragColor;

vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz, iy = Pi.yyww;
  vec4 fx = Pf.xzxz, fy = Pf.yyww;
  vec4 i  = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx -= tx;
  vec2 g00 = vec2(gx.x, gy.x), g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z), g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00),dot(g01,g01),dot(g10,g10),dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00,n01), vec2(n10,n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

const int OCTAVES = 4;
float fbm(vec2 p) {
  float value = 0.0, amp = 1.0, freq = uWaveFrequency;
  for (int i = 0; i < OCTAVES; i++) {
    value += amp * abs(cnoise(p));
    p    *= freq;
    amp  *= uWaveAmplitude;
  }
  return value;
}

float pattern(vec2 p) {
  vec2 p2 = p - uTime * uWaveSpeed;
  return fbm(p + fbm(p2));
}

const float bayer[64] = float[64](
   0./64., 48./64., 12./64., 60./64.,  3./64., 51./64., 15./64., 63./64.,
  32./64., 16./64., 44./64., 28./64., 35./64., 19./64., 47./64., 31./64.,
   8./64., 56./64.,  4./64., 52./64., 11./64., 59./64.,  7./64., 55./64.,
  40./64., 24./64., 36./64., 20./64., 43./64., 27./64., 39./64., 23./64.,
   2./64., 50./64., 14./64., 62./64.,  1./64., 49./64., 13./64., 61./64.,
  34./64., 18./64., 46./64., 30./64., 33./64., 17./64., 45./64., 29./64.,
  10./64., 58./64.,  6./64., 54./64.,  9./64., 57./64.,  5./64., 53./64.,
  42./64., 26./64., 38./64., 22./64., 41./64., 25./64., 37./64., 21./64.
);

vec3 linearToSRGB(vec3 v) {
  return mix(
    pow(v, vec3(0.41666)) * 1.055 - 0.055,
    v * 12.92,
    vec3(lessThanEqual(v, vec3(0.0031308)))
  );
}

void main() {
  vec2 b  = floor(gl_FragCoord.xy);
  vec2 uv = b / uRes;
  vec2 p  = uv - 0.5;
  p.x    *= uRes.x / uRes.y;

  vec3 color = mix(vec3(0.0), uWaveColor, pattern(p));

  int   bx        = int(mod(b.x, 8.0));
  int   by        = int(mod(b.y, 8.0));
  float threshold = bayer[by * 8 + bx] - 0.25;
  float step      = 1.0 / (uColorNum - 1.0);
  color          += threshold * step;
  color           = clamp(color - 0.2, 0.0, 1.0);
  color           = floor(color * (uColorNum - 1.0) + 0.5) / (uColorNum - 1.0);

  fragColor = vec4(linearToSRGB(color), 1.0);
}`

export default function WaveCanvas({ wrapperStyle }) {
  const canvasRef = useRef(null)
  const layerRef  = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const layer  = layerRef.current
    const gl     = canvas.getContext('webgl2')
    if (!gl) return

    function makeShader(type, src) {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s))
      return s
    }

    const prog = gl.createProgram()
    gl.attachShader(prog, makeShader(gl.VERTEX_SHADER,   VERT))
    gl.attachShader(prog, makeShader(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(prog))
    gl.useProgram(prog)

    const U = {}
    for (const n of ['uRes','uTime','uWaveSpeed','uWaveFrequency','uWaveAmplitude','uWaveColor','uColorNum'])
      U[n] = gl.getUniformLocation(prog, n)

    const params = {
      waveSpeed:     0.035,
      waveFrequency: 3.2,
      waveAmplitude: 0.28,
      waveColor:     [0.72, 0.72, 0.72],
      colorNum:      4,
      pixelSize:     2,
    }

    function resize() {
      const ps = Math.max(1, params.pixelSize)
      const w  = Math.ceil(layer.offsetWidth  / ps)
      const h  = Math.ceil(layer.offsetHeight / ps)
      if (canvas.width === w && canvas.height === h) return
      canvas.width  = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
      gl.uniform2f(U.uRes, w, h)
    }

    function setUniforms() {
      gl.uniform1f(U.uWaveSpeed,     params.waveSpeed)
      gl.uniform1f(U.uWaveFrequency, params.waveFrequency)
      gl.uniform1f(U.uWaveAmplitude, params.waveAmplitude)
      gl.uniform3fv(U.uWaveColor,    params.waveColor)
      gl.uniform1f(U.uColorNum,      params.colorNum)
    }

    const t0 = performance.now()
    let raf = 0
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')

    function tick(ts) {
      raf = requestAnimationFrame(tick)
      resize()
      setUniforms()
      gl.uniform1f(U.uTime, (ts - t0) * 0.001)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    if (mq.matches) {
      resize(); setUniforms()
      gl.uniform1f(U.uTime, 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    } else {
      raf = requestAnimationFrame(tick)
    }

    function onVisibility() {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0 }
      else if (!raf)        { raf = requestAnimationFrame(tick) }
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div ref={layerRef} style={wrapperStyle}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }} />
    </div>
  )
}
