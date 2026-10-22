const assetRepository = require('../repositories/asset.repository');

class AssetService {
    async getTypes(orgId) {
        let types = await assetRepository.getTypes(orgId);
        if (!types || types.length === 0) {
            const defaultAssetTypes = [
                'Heavy Equipment',
                'Vehicles & Transport',
                'Power Tools & Machinery',
                'Hand Tools & Hardware',
                'Safety & Protective Gear',
                'Electronics & Diagnostics'
            ];
            for (const name of defaultAssetTypes) {
                await assetRepository.createType(orgId, name);
            }
            types = await assetRepository.getTypes(orgId);
        }
        return types;
    }

    async getCustomFields(typeId) {
        return await assetRepository.getCustomFields(typeId);
    }

    async getAllAssets(user, filters) {
        return await assetRepository.findAll(user, filters);
    }

    async getAssetById(id, user) {
        return await assetRepository.findById(id, user);
    }

    async createAsset(assetData) {
        return await assetRepository.create(assetData);
    }

    async updateAsset(id, assetData, user) {
        return await assetRepository.update(id, assetData, user);
    }

    async archiveAsset(id, user) {
        return await assetRepository.archive(id, user);
    }

    async restoreAsset(id, user) {
        return await assetRepository.restore(id, user);
    }

    async getAssetHistory(id, user) {
        return await assetRepository.getAssetHistory(id, user);
    }
}

module.exports = new AssetService();
