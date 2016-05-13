precision highp float;
precision highp sampler2D;

// Passed texture coordinate from vertex shader
varying vec2 vTexCoord;

// Textures
uniform sampler2D fixedImage;
uniform sampler2D movingImage;

void main(void) {

  // subtract
  gl_FragColor = abs( texture2D(fixedImage, vTexCoord) - texture2D(movingImage,vTexCoord) );
  gl_FragColor = abs ( texture2D(fixedImage, vTexCoord) - texture2D(movingImage,vTexCoord) );
  gl_FragColor.a = 1.0;
  // gl_FragColor = texture2D(fixedImage, vTexCoord);
  // gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
}
