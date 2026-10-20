const assignmentRepository = require('../repositories/assignment.repository');

class AssignmentService {
    getAllAssignments(user, filters) {
        return assignmentRepository.findAll(user, filters);
    }

    checkout(data, user) {
        return assignmentRepository.checkout(data, user);
    }

    returnAsset(id, user) {
        return assignmentRepository.returnAsset(id, user);
    }

    getStats(user) {
        return assignmentRepository.getStats(user);
    }
}

module.exports = new AssignmentService();
