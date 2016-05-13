precision highp float;
precision highp sampler2D;

attribute vec2 position;
attribute vec2 texPosition;

// Pass the texture coordinate to the fragment shader
varying vec2 vTexCoord;

void main()
{
	gl_Position = vec4(position,0,1);
  vTexCoord = texPosition;
}
