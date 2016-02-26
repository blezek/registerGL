precision highp float;

// uniform sampler2D sourceTextureSampler;

// Passed texture coordinate from vertex shader
varying vec2 vTexCoord;

// Textures
uniform sampler2D fixedImage;

void main(void) {
  // gl_FragColor = texture2D(sourceTextureSampler, varyingTextureCoordinate);
  // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
  gl_FragColor = vec4(0, 1.0, 0, 1.0 );
  gl_FragColor = vec4(vTexCoord.y, 0, 0, 1.0);
  gl_FragColor = texture2D(fixedImage, vTexCoord);
  // gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
}
