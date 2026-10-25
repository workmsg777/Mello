const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  createPhotoFormData,
} = require('../../frontend/src/services/photo-upload.ts');

test('web picker File is sent as bytes rather than an object string', async () => {
  const file = new File(['photo-bytes'], 'portrait.png', { type: 'image/png' });
  const form = await createPhotoFormData({ uri: 'blob:unused', file }, 'web');
  const photo = form.get('photo');
  assert.ok(photo instanceof File);
  assert.equal(photo.name, 'portrait.png');
  assert.equal(photo.type, 'image/png');
  assert.equal(await photo.text(), 'photo-bytes');
});

test('web URI fallback reads the image and retains its MIME type', async () => {
  const form = await createPhotoFormData(
    { uri: 'data:image/png;base64,aW1hZ2U=' },
    'web',
  );
  const photo = form.get('photo');
  assert.equal(await photo.text(), 'image');
  assert.equal(photo.type, 'image/png');
  assert.ok(photo.name.endsWith('.png'));
});

test('native picker retains the React Native URI upload descriptor', async (t) => {
  const OriginalFormData = global.FormData;
  t.after(() => {
    global.FormData = OriginalFormData;
  });
  global.FormData = class {
    append(name, value) {
      this.name = name;
      this.value = value;
    }
  };
  const asset = {
    uri: 'file:///photos/portrait.jpg',
    fileName: 'portrait.jpg',
    mimeType: 'image/jpeg',
  };
  const form = await createPhotoFormData(asset, 'native');
  assert.equal(form.name, 'photo');
  assert.deepEqual(form.value, {
    uri: asset.uri,
    name: asset.fileName,
    type: asset.mimeType,
  });
});

test('empty browser files are rejected before upload', async () => {
  await assert.rejects(
    createPhotoFormData(
      {
        uri: 'blob:unused',
        file: new File([], 'empty.jpg', { type: 'image/jpeg' }),
      },
      'web',
    ),
    /empty/,
  );
});
