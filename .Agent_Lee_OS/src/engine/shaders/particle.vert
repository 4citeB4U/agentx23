/* particle.vert — 4K-clean soft particle vertex shader */
attribute vec3 position;
attribute float size;         /* per-particle size variance (optional) */
attribute float brightness;   /* velocity-based brightness (optional) */

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;
uniform float uPointScale;   /* set = renderer height * 0.5 for consistent sizing */

varying float vAlpha;
varying float vBrightness;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

  /* Perspective-correct point size — stays crisp at 4K */
  float sizeAttribute = max(size, 0.5);
  gl_PointSize = (sizeAttribute * uPointScale) / -mvPosition.z;
  gl_PointSize = clamp(gl_PointSize, 0.5, 32.0);

  /* Depth fade — particles far from camera are more transparent */
  float depth = -mvPosition.z;
  vAlpha = smoothstep(50.0, 1.0, depth);

  vBrightness = brightness;

  gl_Position = projectionMatrix * mvPosition;
}
