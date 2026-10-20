const assetRepository = require('../repositories/asset.repository');

class AssetService {
    getTypes(orgId) {
        return assetRepository.getTypes(orgId);
    }

    getCustomFields(typeId) {
        return assetRepository.getCustomFields(typeId);
    }

    getAllAssets(user, filters) {
        return assetRepository.findAll(user, filters);
    }

    getAssetById(id, user) {
        return assetRepository.findById(id, user);
    }

    createAsset(assetData) {
        return assetRepository.create(assetData);
    }

    updateAsset(id, assetData, user) {
        return assetRepository.update(id, assetData, user);
    }

    archiveAsset(id, user) {
        return assetRepository.archive(id, user);
    }

    restoreAsset(id, user) {
        return assetRepository.restore(id, user);
    }

    getAssetHistory(id, user) {
        return assetRepository.getAssetHistory(id, user);
    }
}

module.exports = new AssetService();
