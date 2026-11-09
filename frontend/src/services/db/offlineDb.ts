import Dexie, { type Table } from 'dexie';

export interface LocalIncidentDraft {
  localId: string;
  serverIncidentId?: string;
  farmerId: string;
  farmerName: string;
  audioBlob?: Blob;
  transcript?: string;
  wildlifeSpecies?: string;
  wildlifeSpeciesTamil?: string;
  cropDamaged?: string;
  cropDamagedTamil?: string;
  damageQuantity?: number;
  damageUnit?: string;
  damageUnitTamil?: string;
  attackPattern?: string;
  status: 'DRAFT_LOCAL' | 'SYNCING' | 'SYNCED';
  createdAt: number;
}

export interface LocalEvidencePhoto {
  id: string;
  localDraftId: string;
  photoType: 'WIDE_ANGLE' | 'CLOSE_UP_SPOOR';
  dataUrl: string;  // Base64 dataUrl for offline thumbnail rendering
  blob: Blob;
  latitude: number;
  longitude: number;
  capturedAt: string;
  isSynced: boolean;
}

export interface SyncTask {
  id?: number;
  taskType: 'UPLOAD_VOICE' | 'UPLOAD_PHOTO' | 'GENERATE_DOSSIER';
  payloadRefId: string;
  retryCount: number;
  lastAttemptAt?: number;
}

export class RaidProofDatabase extends Dexie {
  drafts!: Table<LocalIncidentDraft, string>;
  photos!: Table<LocalEvidencePhoto, string>;
  syncQueue!: Table<SyncTask, number>;

  constructor() {
    super('RaidProofLocalDB');
    this.version(1).stores({
      drafts: 'localId, status, createdAt',
      photos: 'id, localDraftId, isSynced',
      syncQueue: '++id, taskType, payloadRefId, retryCount'
    });
  }
}

export const offlineDb = new RaidProofDatabase();
