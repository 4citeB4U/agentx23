/* core.frag — Physically-based core: Fresnel + emission + pulse */
precision highp float;

varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;

uniform float uTime;
uniform float uPulse;        /* 0..1 animation pulse                    */
uniform vec3  uCoreColor;    /* core base emission color                */
uniform float uMetalness;
uniform float uRoughness;

/* ── Fresnel approximation (Schlick) ── */
float fresnel(vec3 n, vec3 v, float f0) {
  float cosTheta = clamp(dot(n, v), 0.0, 1.0);
  return f0 + (1.0 - f0) * pow(1.0 - cosTheta, 5.0);
}

/* ── Cheap PBR specular ── */
float specular(vec3 n, vec3 v) {
  vec3 h = normalize(v + vec3(0.0, 1.0, 0.0));
  float NdotH = max(dot(n, h), 0.0);
  float roughSq = uRoughness * uRoughness;
  return pow(NdotH, mix(512.0, 2.0, roughSq));
}

void main() {
  vec3  n   = normalize(vNormal);
  vec3  v   = normalize(vViewDir);

  /* Fresnel rim — energy concentrates at silhouette */
  float f   = fresnel(n, v, 0.05);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);

  /* Emission pulse — breathes with uPulse */
  float pulse   = 0.8 + 0.2 * sin(uTime * 2.0) * uPulse;
  vec3  emit    = uCoreColor * pulse;

  /* Specular highlight */
  float spec    = specular(n, v) * (1.0 - uRoughness);

  /* Combine: emission + rim glow + spec */
  vec3  color   = emit + uCoreColor * rim * 2.0 + vec3(spec) * uMetalness;

  /* Slight iridescence on rim via time-shifted hue rotation */
  float iri     = rim * 0.3;
  color += vec3(
    sin(uTime * 0.7 + vUv.x * 6.28) * iri,
    sin(uTime * 0.9 + vUv.y * 6.28) * iri,
    sin(uTime * 1.1 + vUv.x * 3.14) * iri
  );

  gl_FragColor = vec4(color, 1.0);
}
