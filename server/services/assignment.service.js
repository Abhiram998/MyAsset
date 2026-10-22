const assignmentRepository = require('../repositories/assignment.repository');

class AssignmentService {
    async getAllAssignments(user, filters) {
        return await assignmentRepository.findAll(user, filters);
    }

    async checkout(data, user) {
        return await assignmentRepository.checkout(data, user);
    }

    async returnAsset(id, user) {
        return await assignmentRepository.returnAsset(id, user);
    }

    async getStats(user) {
        return await assignmentRepository.getStats(user);
    }
}

module.exports = new AssignmentService();
