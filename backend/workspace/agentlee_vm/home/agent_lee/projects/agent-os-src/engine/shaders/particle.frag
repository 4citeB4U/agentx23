/* particle.frag — Soft circular particles, bloom-ready, 4K clean */
precision highp float;

uniform vec3  uColor;        /* base particle color                  */
uniform vec3  uColorB;       /* secondary color for gradient blend   */
uniform float uTime;
uniform float uGlobalAlpha;  /* master opacity (fade in/out)         */

varying float vAlpha;
varying float vBrightness;

void main() {
  /* Distance from point center — gl_PointCoord is 0..1 per sprite */
  vec2  coord = gl_PointCoord - vec2(0.5);
  float dist  = length(coord);

  /* Discard outside circle — no square edges */
  if (dist > 0.5) discard;

  /* Soft radial falloff — smooth inner core + feathered edge */
  float core    = smoothstep(0.15, 0.0,  dist);     /* bright  center */
  float halo    = smoothstep(0.5,  0.15, dist);     /* soft    halo   */
  float alpha   = halo + core * 0.5;

  /* Fresnel-edge glow — rim brightens at edges like real energy */
  float fresnel = pow(1.0 - dist * 2.0, 1.5);

  /* Velocity-brightness: faster particles glow more */
  float bright  = 1.0 + vBrightness * 0.8 + fresnel * 0.4;

  /* Color gradient — blend base to secondary by radius */
  vec3  color   = mix(uColor, uColorB, dist * 2.0) * bright;

  /* Combine all alpha sources */
  float finalA  = alpha * vAlpha * uGlobalAlpha;

  gl_FragColor  = vec4(color, finalA);
}
