import { createHash } from 'node:crypto';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const arrayBytes = array => new Uint8Array(array.buffer, array.byteOffset, array.byteLength);

export function vegetationGeometrySignatures(group) {
  group.updateMatrixWorld(true);
  return group.children.filter(part => part.userData.id !== 'lake-rock').map(part => {
    const meshes = [];
    part.traverse(mesh => {
      if (!mesh.isMesh) return;
      const geometry = mesh.geometry, hash = createHash('sha256');
      for (const [name, attribute] of [...Object.entries(geometry.attributes), ['index', geometry.index]].sort(([a], [b]) => a.localeCompare(b))) {
        hash.update(name).update('\0').update(String(attribute.itemSize)).update('\0').update(attribute.array.constructor.name).update('\0').update(arrayBytes(attribute.array)).update('\0');
      }
      const record = { name: mesh.name, geometrySha256: hash.digest('hex'), triangles: geometry.index.count / 3, worldMatrix: [...mesh.matrixWorld.elements] };
      if (mesh.isInstancedMesh) { record.instanceCount = mesh.count; record.instanceMatrixSha256 = digest(arrayBytes(mesh.instanceMatrix.array)); record.instanceColorSha256 = digest(arrayBytes(mesh.instanceColor.array)); }
      meshes.push(record);
    });
    meshes.sort((a, b) => a.name.localeCompare(b.name));
    return { id: part.userData.id, sha256: digest(JSON.stringify(meshes)), meshes };
  }).sort((a, b) => a.id.localeCompare(b.id));
}
