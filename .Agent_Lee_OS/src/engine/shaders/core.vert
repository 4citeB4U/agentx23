/* core.vert — Solid core mesh with normal-based Fresnel prep */
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;

uniform float uTime;
uniform float uPulse;   /* 0..1 animation pulse driven by audio/state */

void main() {
  /* Subtle animated normal distortion — core "breathes" */
  vec3 pos = position;
  float disp = sin(normal.x * 8.0 + uTime * 1.5) *
               cos(normal.y * 7.0 + uTime * 1.2) * 0.02 * uPulse;
  pos += normal * disp;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

  vNormal  = normalize(normalMatrix * normal);
  vViewDir = normalize(-mvPosition.xyz);
  vUv      = uv;

  gl_Position = projectionMatrix * mvPosition;
}
