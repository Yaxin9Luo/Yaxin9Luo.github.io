import {writeFile} from 'node:fs/promises';
import {profile,research,experience,journey,publications,openSource} from '../world/src/content.js';
import {selectedProjects} from '../world/src/exhibition-content.js';

// Both website entrances use the same reviewed facts and dated GitHub snapshot.
const projects=selectedProjects.filter(item=>openSource.repositories[item.id]);
const data={profile,research,experience,journey,publications,projects};
await writeFile(new URL('../_data/portfolio.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log(`Synced bilingual portfolio: ${publications.length} papers, ${projects.length} open-source projects.`);
