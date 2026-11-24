const ResEdit=require('resedit'),fs=require('fs');
const exePath='dist/win-unpacked/TacTech.exe';
const exe=ResEdit.NtExecutable.from(fs.readFileSync(exePath),{ignoreCert:true});
const res=ResEdit.NtExecutableResource.from(exe);
const ico=ResEdit.Data.IconFile.from(fs.readFileSync('build/icon.ico'));
const groups=ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const gid=groups.length?groups[0].id:1, lang=groups.length?groups[0].lang:1033;
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries,gid,lang,ico.icons.map(i=>i.data));
const vi=ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
if(vi){vi.setStringValues({lang:1033,codepage:1200},{ProductName:'TacTech',FileDescription:'TacTech - Taktik Tahtası',CompanyName:'Mehmet Can Biçer',OriginalFilename:'TacTech.exe'});vi.outputToResourceEntries(res.entries);}
res.outputResource(exe);fs.writeFileSync(exePath,Buffer.from(exe.generate()));
console.log('icon set, group',gid);
