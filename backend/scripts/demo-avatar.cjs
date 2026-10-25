const { deflateSync } = require('node:zlib');

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type),
    length = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

/** Local illustrated avatars, deliberately fictional and independent of external image services. */
function demoAvatar(index, variant, gender) {
  const width = 360,
    height = 480,
    pixels = Buffer.alloc(width * height * 4);
  const backgrounds = [
    [244, 219, 222],
    [224, 231, 219],
    [221, 224, 241],
    [241, 225, 202],
    [219, 233, 233],
    [236, 220, 235],
  ];
  const clothing = [
    [116, 71, 99],
    [55, 108, 101],
    [194, 106, 91],
    [74, 98, 140],
    [155, 118, 62],
    [128, 104, 139],
  ];
  const skin = [
    [239, 188, 150],
    [190, 129, 91],
    [221, 160, 116],
    [151, 97, 71],
    [245, 203, 171],
  ];
  const hair = [
    [57, 38, 34],
    [38, 33, 36],
    [88, 57, 40],
    [62, 44, 38],
  ];
  const bg = backgrounds[(index + variant) % backgrounds.length];
  for (let p = 0; p < pixels.length; p += 4) {
    pixels[p] = bg[0];
    pixels[p + 1] = bg[1];
    pixels[p + 2] = bg[2];
    pixels[p + 3] = 255;
  }
  const ellipse = (cx, cy, rx, ry, color) => {
    for (
      let y = Math.max(0, Math.floor(cy - ry));
      y < Math.min(height, Math.ceil(cy + ry));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(cx - rx));
        x < Math.min(width, Math.ceil(cx + rx));
        x++
      ) {
        const distance =
          ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        if (distance <= 1) {
          const offset = (y * width + x) * 4;
          pixels[offset] = color[0];
          pixels[offset + 1] = color[1];
          pixels[offset + 2] = color[2];
        }
      }
  };
  const face = skin[index % skin.length],
    dark = hair[index % hair.length];
  const x = 180 + (variant - 1) * 13;
  ellipse(290, 70, 100, 100, [250, 242, 230]);
  ellipse(60, 420, 125, 150, [
    Math.max(bg[0] - 10, 0),
    Math.max(bg[1] - 12, 0),
    Math.max(bg[2] - 9, 0),
  ]);
  ellipse(x, 224, 91, gender === 'WOMAN' ? 145 : 99, dark);
  ellipse(x, 462, 148, 135, clothing[index % clothing.length]);
  ellipse(x, 321, 29, 48, face);
  ellipse(x, 229, 67, 90, face);
  ellipse(x - 36, 151, 47, 35, dark);
  ellipse(x + 15, 140, 61, 33, dark);
  ellipse(x - 24, 227, 5, 6, [44, 34, 34]);
  ellipse(x + 24, 227, 5, 6, [44, 34, 34]);
  ellipse(x, 270, 19, 10, [158, 77, 80]);
  ellipse(x, 266, 20, 8, face);
  ellipse(x + 3, 246, 4, 11, [
    Math.max(face[0] - 18, 0),
    Math.max(face[1] - 18, 0),
    Math.max(face[2] - 18, 0),
  ]);
  if (index % 3 === 0) {
    ellipse(x - 24, 227, 21, 17, dark);
    ellipse(x + 24, 227, 21, 17, dark);
    ellipse(x - 24, 227, 18, 14, face);
    ellipse(x + 24, 227, 18, 14, face);
    ellipse(x - 24, 227, 5, 6, dark);
    ellipse(x + 24, 227, 5, 6, dark);
  }
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++)
    pixels.copy(
      rows,
      y * (width * 4 + 1) + 1,
      y * width * 4,
      (y + 1) * width * 4,
    );
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk(
      'tEXt',
      Buffer.from('Description\0Fictional adult Mello demo avatar'),
    ),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
module.exports = { demoAvatar };
