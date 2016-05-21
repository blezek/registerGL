

var register = {

  canvas: document.getElementById('canvas'),
  gl: null,

  // Textures
  fixedTexture: null,
  movingTexture: null,

  // Currently displayed image values
  pixels: null,
  
  // buffer is the gemotery array for the triangles
  buffer: null,

  // Texture coordinates
  textureCoordBuffer: null,

  // programs
  programs: {},
  // Metric program subtracts two textures
  metricProgram: null,

  // Display program simply renders an image
  displayProgram: null,

  // Sum program will add and downsample
  sumProgram: null,

  // Framebuffer
  framebuffer: null,
  
  // Texture for difference image
  textures: {},
  sumPyramid: [],
  outPyramid: [],
  differenceTexture: null,
};



$(function() {
  init();
});



function init() {
  var gl = register.gl = canvas.getContext("webgl");
  
  if ( !gl.getExtension('OES_texture_float') ) {
    alert ( "This browser does not support floating point textures!" );
  };

  // Off screen frame buffer
  register.framebuffer = gl.createFramebuffer();
  
  // Vertex buffer
  var buffer = register.buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData( gl.ARRAY_BUFFER,
                 new Float32Array([
                     -1.0, -1.0,
                      1.0, -1.0,
                     -1.0,  1.0,
                     -1.0,  1.0,
                      1.0, -1.0,
                      1.0,  1.0]),
                 gl.STATIC_DRAW);

  // Texture coordinates need to correspond to the vertex coordinates
  var textureCoordBuffer = register.textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0,0,
    1,0,
    0,1,
    0,1,
    1,0,
    1,1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // Textures needed
  register.textures["A"] = create_float_texture ( register, 512, 512 );
  register.textures["B"] = create_float_texture ( register, 512, 512 );
  register.textures["encode"] = create_float_texture ( register, 512, 512 );
  register.textures["r"] = create_float_texture ( register, 512, 512 );
  register.textures["dr"] = create_float_texture ( register, 512, 512 );
  register.textures["difference"] = create_float_texture ( register, 512, 512 );
  register.textures["movingGradient"] = create_float_texture ( register, 512, 512 );
  register.textures["displaced"] = create_float_texture ( register, 512, 512 );
  register.textures["fixedGradient"] = create_float_texture ( register, 512, 512 );

  // Load the image via a promise
  load_image(gl, "images/copd1_eBHCT_slice.png").then(function(texture){
  // load_image(gl, "images/preOpT2.png").then(function(texture){
    register.fixedTexture = texture;
    register.textures["fixed"] = texture;
    return load_image(gl,"images/copd1_iBHCT_slice.png");
    // return load_image(gl,"images/intraOpT2.png");
    // return load_image(gl,"images/preOpT2-slight.png");
  }).then(function(texture) {
    register.movingTexture = texture;
    register.textures["moving"] = texture;
    // Chain compiling the code
    return compile_program(gl, "shaders/register.vs", "shaders/display.fs" );
  }).then(function(program){
    register.displayProgram = program;
    return compile_program(gl, "shaders/register.vs", "shaders/difference.fs" );
  }).then(function(program){
    register.programs["difference"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/scale.fs" );
  }).then(function(program){
    register.programs["scale"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/sum.fs" );
  }).then(function(program){
    register.programs["sum"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/copy.fs" );
  }).then(function(program){
    register.programs["copy"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/encode_float.fs" );
  }).then(function(program){
    register.programs["encode_float"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/gradient.fs" );
  }).then(function(program){
    register.programs["gradient"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/smooth.fs" );
  }).then(function(program){
    register.programs["smooth"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/displacement.fs" );
  }).then(function(program){
    register.programs["displacement"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/updateR.fs" );
  }).then(function(program){
    register.programs["updateR"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/displace.fs" );
  }).then(function(program){
    register.programs["displace"] = program;
    // start_render(register);
    display(register,$("#buffer").val());
  }).catch(function(errorMessage){
    console.log("Error: " + errorMessage)
    $("#status").html(errorMessage);
  });


  $("#step").click(function() {
    start_render(register);
  });
  
  $("#step10").click(function() {
    start_render(register,10);
  });

  $("#step100").click(function() {
    start_render(register,100);
  });

  $("#buffer").change(function() {
    display(register,$("#buffer").val());
  });

  $("#scale").change(function() {
    display(register,$("#buffer").val());
  });

  var show_value = function(event) {
    if ( register.pixels == null ) { return; }
    var offset = event.offsetX + (511 - event.offsetY) * 512;
    var dp = 2;
    var text = 'Pixel @ ' + event.offsetX + ", " + event.offsetY + ": " + Number(register.pixels[offset].toFixed(dp)) + ", "
        + Number(register.pixels[offset+512*512].toFixed(dp)) + ", "
        + Number(register.pixels[offset+512*512*2].toFixed(dp));
    $('#value').text(text);
  }
  $("#canvas").mousemove(show_value);
  
  $("#restart").click(function() {
    // Zero the R buffer
    console.log("setting r buffer to 0.0")
    var r = register;
    var gl = r.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["r"], 0);
    render ( r, r.programs["scale"], [
      {name: "image", value: r.textures["A"]},
      {name: "scale", value: 0.0},
    ]);
    display(register,$("#buffer").val());
  });
  
}

function display(r,buffer) {
  var scale = Number($("#scale").attr("value"));
  console.log("Displaying buffer " + buffer + " scale: " + scale);
  var gl = r.gl;
  gl.viewport(0,0,512,512);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  render ( r, r.displayProgram, [
    {name: "image", value: r.textures[buffer]},
    {name: "scale", value: scale},
  ]);

  // Pull the buffer to a local array
  r.pixels = read_texture ( r, r.textures[buffer], 512, 512);
  
  // Do a single step
  // start_render(r);
}

function start_render(r,count) {
  demonsStep(r, count||1);
  display (r, $('#buffer').val());
}




