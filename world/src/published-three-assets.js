import {DefaultLoadingManager} from 'three';
import {publicAssetURL} from './public-asset-url.js';
DefaultLoadingManager.setURLModifier(publicAssetURL);
