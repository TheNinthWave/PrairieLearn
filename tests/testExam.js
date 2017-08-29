var ERR = require('async-stacktrace');
var _ = require('lodash');
var assert = require('chai').assert;
var request = require('request');
var cheerio = require('cheerio');

var config = require('../lib/config');
var sqldb = require('../lib/sqldb');
var sqlLoader = require('../lib/sql-loader');
var sql = sqlLoader.loadSqlEquiv(__filename);

var helperServer = require('./helperServer');
var helperQuestion = require('./helperQuestion');

const locals = {};

locals.siteUrl = 'http://localhost:' + config.serverPort;
locals.baseUrl = locals.siteUrl + '/pl';
locals.courseInstanceBaseUrl = locals.baseUrl + '/course_instance/1';
locals.questionBaseUrl = locals.courseInstanceBaseUrl + '/instance_question';
locals.assessmentsUrl = locals.courseInstanceBaseUrl + '/assessments';
locals.isStudentPage = true;

const addNumbers = {qid: 'addNumbers', type: 'Freeform'};
const addVectors = {qid: 'addVectors', type: 'Calculation'};
const fossilFuelsRadio = {qid: 'fossilFuelsRadio', type: 'Calculation'};

describe('Exam assessment', function() {
    this.timeout(5000);

    before('set up testing server', helperServer.before);
    after('shut down testing server', helperServer.after);

    var res, page, elemList;

    describe('the database', function() {
        it('should contain E1', function(callback) {
            sqldb.queryOneRow(sql.select_e1, [], function(err, result) {
                if (ERR(err, callback)) return;
                locals.assessment_id = result.rows[0].id;
                callback(null);
            });
        });
    });

    describe('GET ' + locals.assessmentsUrl, function() {
        it('should load successfully', function(callback) {
            request(locals.assessmentsUrl, function (error, response, body) {
                if (error) {
                    return callback(error);
                }
                if (response.statusCode != 200) {
                    return callback(new Error('bad status: ' + response.statusCode));
                }
                res = response;
                page = body;
                callback(null);
            });
        });
        it('should parse', function() {
            locals.$ = cheerio.load(page);
        });
        it('should contain E1', function() {
            elemList = locals.$('td a:contains("Exam for automatic test suite")');
            assert.lengthOf(elemList, 1);
        });
        it('should have the correct link for E1', function() {
            locals.assessmentUrl = locals.siteUrl + elemList[0].attribs.href;
            assert.equal(locals.assessmentUrl, locals.courseInstanceBaseUrl + '/assessment/' + locals.assessment_id + '/');
        });
    });

    describe('GET to assessment URL', function() {
        it('should load successfully', function(callback) {
            request(locals.assessmentUrl, function (error, response, body) {
                if (error) {
                    return callback(error);
                }
                if (response.statusCode != 200) {
                    return callback(new Error('bad status: ' + response.statusCode));
                }
                res = response;
                page = body;
                callback(null);
            });
        });
        it('should parse', function() {
            locals.$ = cheerio.load(page);
        });
        it('should contain "Please wait"', function() {
            elemList = locals.$('p.lead:contains("Please wait")');
            assert.lengthOf(elemList, 1);
        });
        it('should contain "Exam 1"', function() {
            elemList = locals.$('p.lead strong:contains("Exam 1")');
            assert.lengthOf(elemList, 1);
        });
        it('should contain "TPL 101"', function() {
            elemList = locals.$('p.lead strong:contains("TPL 101")');
            assert.lengthOf(elemList, 1);
        });
        it('should have a CSRF token', function() {
            elemList = locals.$('form input[name="__csrf_token"]');
            assert.lengthOf(elemList, 1);
            assert.deepProperty(elemList[0], 'attribs.value');
            locals.__csrf_token = elemList[0].attribs.value;
            assert.isString(locals.__csrf_token);
        });
    });

    describe('POST to assessment URL', function() {
        it('should load successfully', function(callback) {
            var form = {
                __action: 'newInstance',
                __csrf_token: locals.__csrf_token,
            };
            locals.preStartTime = Date.now();
            request.post({url: locals.assessmentUrl, form: form, followAllRedirects: true}, function (error, response, body) {
                if (error) {
                    return callback(error);
                }
                locals.postStartTime = Date.now();
                if (response.statusCode != 200) {
                    return callback(new Error('bad status: ' + response.statusCode));
                }
                res = response;
                page = body;
                callback(null);
            });
        });
        it('should parse', function() {
            locals.$ = cheerio.load(page);
        });
        it('should redirect to the correct path', function() {
            locals.assessmentInstanceUrl = locals.siteUrl + res.req.path;
            assert.equal(res.req.path, '/pl/course_instance/1/assessment_instance/1');
        });
        it('should create one assessment_instance', function(callback) {
            sqldb.query(sql.select_assessment_instances, [], function(err, result) {
                if (ERR(err, callback)) return;
                if (result.rowCount != 1) {
                    return callback(new Error('expected one assessment_instance, got: ' + result.rowCount));
                }
                locals.assessment_instance = result.rows[0];
                callback(null);
            });
        });
        it('should have the correct assessment_instance.assessment_id', function() {
            assert.equal(locals.assessment_instance.assessment_id, locals.assessment_id);
        });
        it('should create three instance_questions', function(callback) {
            sqldb.query(sql.select_instance_questions, [], function(err, result) {
                if (ERR(err, callback)) return;
                if (result.rowCount != 3) {
                    return callback(new Error('expected three instance_questions, got: ' + result.rowCount));
                }
                locals.instance_questions = result.rows;
                callback(null);
            });
        });
        it('should have the correct first question', function() {
            addNumbers.id = locals.instance_questions[0].id;
            assert.equal(locals.instance_questions[0].qid, addNumbers.qid);
        });
        it('should have the correct second question', function() {
            addVectors.id = locals.instance_questions[1].id;
            assert.equal(locals.instance_questions[1].qid, addVectors.qid);
        });
        it('should have the correct third question', function() {
            fossilFuelsRadio.id = locals.instance_questions[2].id;
            assert.equal(locals.instance_questions[2].qid, fossilFuelsRadio.qid);
        });
    });

    describe('GET to assessment_instance URL', function() {
        it('should load successfully', function(callback) {
            request(locals.assessmentInstanceUrl, function (error, response, body) {
                if (error) {
                    return callback(error);
                }
                if (response.statusCode != 200) {
                    return callback(new Error('bad status: ' + response.statusCode));
                }
                res = response;
                page = body;
                callback(null);
            });
        });
        it('should parse', function() {
            locals.$ = cheerio.load(page);
        });
        it('should link to addNumbers question', function() {
            const urlTail = '/pl/course_instance/1/instance_question/' + addNumbers.id + '/';
            addNumbers.url = locals.siteUrl + urlTail;
            elemList = locals.$(`td a[href="${urlTail}"]`);
            assert.lengthOf(elemList, 1);
        });
        it('should link to addVectors question', function() {
            const urlTail = '/pl/course_instance/1/instance_question/' + addVectors.id + '/';
            addVectors.url = locals.siteUrl + urlTail;
            elemList = locals.$(`td a[href="${urlTail}"]`);
            assert.lengthOf(elemList, 1);
        });
        it('should link to fossilFuelsRadio question', function() {
            const urlTail = '/pl/course_instance/1/instance_question/' + fossilFuelsRadio.id + '/';
            fossilFuelsRadio.url = locals.siteUrl + urlTail;
            elemList = locals.$(`td a[href="${urlTail}"]`);
            assert.lengthOf(elemList, 1);
        });
    });

    describe('1. save correct answer to question addVectors', function() {
        describe('setting up the submission data', function() {
            it('should succeed', function() {
                locals.shouldHaveButtons = ['grade', 'save'];
                locals.postAction = 'save';
                locals.question = addVectors;
                locals.expectedResult = {
                    submission_score: null,
                    submission_correct: null,
                    instance_question_points: 0,
                    instance_question_score_perc: 0/11 * 100,
                    assessment_instance_points: 0,
                    assessment_instance_score_perc: 0/33 * 100,
                };
                locals.getSubmittedAnswer = function(variant) {
                    return {
                        wx: variant.true_answer.wx,
                        wy: variant.true_answer.wy,
                    };
                };
            });
        });
        helperQuestion.getInstanceQuestion(locals);
        helperQuestion.postInstanceQuestion(locals);
    });

    describe('2. grade incorrect answer to question addVectors', function() {
        describe('setting up the submission data', function() {
            it('should succeed', function() {
                locals.shouldHaveButtons = ['grade', 'save'];
                locals.postAction = 'grade';
                locals.question = addVectors;
                locals.expectedResult = {
                    submission_score: 0,
                    submission_correct: false,
                    instance_question_points: 0,
                    instance_question_score_perc: 0/11 * 100,
                    assessment_instance_points: 0,
                    assessment_instance_score_perc: 0/33 * 100,
                };
                locals.getSubmittedAnswer = function(_variant) {
                    return {
                        wx: -500,
                        wy: 700,
                    };
                };
            });
        });
        helperQuestion.getInstanceQuestion(locals);
        helperQuestion.postInstanceQuestion(locals);
    });

    describe('3. grade incorrect answer to question addNumbers', function() {
        describe('setting up the submission data', function() {
            it('should succeed', function() {
                locals.shouldHaveButtons = ['grade', 'save'];
                locals.postAction = 'grade';
                locals.question = addNumbers;
                locals.expectedResult = {
                    submission_score: 0,
                    submission_correct: false,
                    instance_question_points: 0,
                    instance_question_score_perc: 0/5 * 100,
                    assessment_instance_points: 0,
                    assessment_instance_score_perc: 0/33 * 100,
                };
                locals.getSubmittedAnswer = function(variant) {
                    return {
                        c: variant.true_answer.c + 1,
                    };
                };
            });
        });
        helperQuestion.getInstanceQuestion(locals);
        helperQuestion.postInstanceQuestion(locals);
    });

    describe('4. grade incorrect answer to question fossilFuelsRadio', function() {
        describe('setting up the submission data', function() {
            it('should succeed', function() {
                locals.shouldHaveButtons = ['grade', 'save'];
                locals.postAction = 'grade';
                locals.question = fossilFuelsRadio;
                locals.expectedResult = {
                    submission_score: 0,
                    submission_correct: false,
                    instance_question_points: 0,
                    instance_question_score_perc: 0/17 * 100,
                    assessment_instance_points: 0,
                    assessment_instance_score_perc: 0/33 * 100,
                };
                locals.getSubmittedAnswer = function(variant) {
                    return {
                        key: (variant.true_answer.key == 'a') ? 'b' : 'a',
                    };
                };
            });
        });
        helperQuestion.getInstanceQuestion(locals);
        helperQuestion.postInstanceQuestion(locals);
    });

    describe('6. grade invalid answer to question addNumbers', function() {
        describe('setting up the submission data', function() {
            it('should succeed', function() {
                locals.shouldHaveButtons = ['grade', 'save'];
                locals.postAction = 'grade';
                locals.question = addNumbers;
                locals.expectedResult = {
                    submission_score: null,
                    submission_correct: null,
                    instance_question_points: 0,
                    instance_question_score_perc: 0/17 * 100,
                    assessment_instance_points: 0,
                    assessment_instance_score_perc: 0/33 * 100,
                };
                locals.getSubmittedAnswer = function(_variant) {
                    return {
                        c: 'not_a_number',
                    };
                };
            });
        });
        helperQuestion.getInstanceQuestion(locals);
        helperQuestion.postInstanceQuestion(locals);
        describe('check the submission is not gradable', function() {
            it('should succeed', function(callback) {
                sqldb.queryOneRow(sql.select_last_submission, [], function(err, result) {
                    if (ERR(err, callback)) return;
                    const submission = result.rows[0];
                    if (submission.gradable) return callback(new Error('submission.gradable is true'));
                    callback(null);
                });
            });
        });
        describe('the submission panel contents', function() {
            it('should contain "INVALID"', function() {
                elemList = locals.$('div.submission-body :contains("INVALID")');
                assert.isAtLeast(elemList.length, 1);
            });
        });
    });

    describe('8. save incorrect answer to question addNumbers', function() {
        describe('setting up the submission data', function() {
            it('should succeed', function() {
                locals.shouldHaveButtons = ['grade', 'save'];
                locals.postAction = 'save';
                locals.question = addNumbers;
                locals.getSubmittedAnswer = function(variant) {
                    return {
                        c: variant.true_answer.c - 1,
                    };
                };
            });
        });
        helperQuestion.getInstanceQuestion(locals);
        helperQuestion.postInstanceQuestion(locals);
    });

    describe('9. break the addNumbers variant', function() {
        describe('setting the question', function() {
            it('should succeed', function() {
                locals.shouldHaveButtons = ['grade', 'save'];
                locals.postAction = 'save';
                locals.question = addNumbers;
            });
        });
        helperQuestion.getInstanceQuestion(locals);
        describe('breaking the variant', function() {
            it('should succeed', function(callback) {
                let params = {
                    variant_id: locals.variant.id,
                    broken: true,
                };
                sqldb.queryOneRow(sql.variant_update_broken, params, function(err, _result) {
                    if (ERR(err, callback)) return;
                    callback(null);
                });
            });
        });
    });

    describe('10. a broken variant', function() {
        describe('setting the question', function() {
            it('should succeed', function() {
                locals.shouldHaveButtons = [];
                locals.postAction = 'save';
                locals.question = addNumbers;
            });
        });
        helperQuestion.getInstanceQuestion(locals);
        describe('the question panel contents', function() {
            it('should contain "Broken question"', function() {
                elemList = locals.$('div.question-body:contains("Broken question")');
                assert.lengthOf(elemList, 1);
            });
        });
        describe('un-breaking the variant', function() {
            it('should succeed', function(callback) {
                let params = {
                    variant_id: locals.variant.id,
                    broken: false,
                };
                sqldb.queryOneRow(sql.variant_update_broken, params, function(err, _result) {
                    if (ERR(err, callback)) return;
                    callback(null);
                });
            });
        });
    });

    describe('15. load question addNumbers page and save data for later submission', function() {
        describe('setting up the submission data', function() {
            it('should succeed', function() {
                locals.shouldHaveButtons = ['grade', 'save'];
                locals.question = addNumbers;
            });
        });
        helperQuestion.getInstanceQuestion(locals);
        describe('save data for later submission', function() {
            it('should succeed', function() {
                locals.savedVariant = _.clone(locals.variant);
                locals.questionSavedCsrfToken = locals.__csrf_token;
            });
        });
    });

    describe('11. grade correct answer to question addNumbers', function() {
        describe('setting up the submission data', function() {
            it('should succeed', function() {
                locals.shouldHaveButtons = ['grade', 'save'];
                locals.postAction = 'grade';
                locals.question = addNumbers;
                locals.expectedResult = {
                    submission_score: 1,
                    submission_correct: true,
                    instance_question_points: 0,
                    instance_question_score_perc: 3/5 * 100,
                    assessment_instance_points: 3,
                    assessment_instance_score_perc: 3/33 * 100,
                };
                locals.getSubmittedAnswer = function(variant) {
                    return {
                        c: variant.true_answer.c,
                    };
                };
            });
        });
        helperQuestion.getInstanceQuestion(locals);
        helperQuestion.postInstanceQuestion(locals);
    });

    describe('17. save correct answer to saved question addNumbers page', function() {
        describe('setting up the submission data', function() {
            it('should succeed', function() {
                locals.question = addNumbers;
                locals.postAction = 'save';
                locals.getSubmittedAnswer = function(variant) {
                    return {
                        c: variant.true_answer.c,
                    };
                };
            });
        });
        describe('restore saved data for submission', function() {
            it('should succeed', function() {
                locals.variant = _.clone(locals.savedVariant);
                locals.__csrf_token = locals.questionSavedCsrfToken;
            });
        });
        helperQuestion.postInstanceQuestionAndFail(locals);
    });

    describe('18. save incorrect answer to question fossilFuelsRadio', function() {
        describe('setting up the submission data', function() {
            it('should succeed', function() {
                locals.shouldHaveButtons = ['grade', 'save'];
                locals.postAction = 'save';
                locals.question = fossilFuelsRadio;
                locals.expectedResult = {
                    submission_score: 0,
                    submission_correct: false,
                    instance_question_points: 0,
                    instance_question_score_perc: 0/17 * 100,
                    assessment_instance_points: 3,
                    assessment_instance_score_perc: 3/33 * 100,
                };
                locals.getSubmittedAnswer = function(variant) {
                    return {
                        key: (variant.true_answer.key == 'a') ? 'b' : 'a',
                    };
                };
            });
        });
        helperQuestion.getInstanceQuestion(locals);
        helperQuestion.postInstanceQuestion(locals);
    });

    describe('20. load question addVectors page and save data for later submission', function() {
        describe('setting up the submission data', function() {
            it('should succeed', function() {
                locals.shouldHaveButtons = ['grade', 'save'];
                locals.question = addVectors;
            });
        });
        helperQuestion.getInstanceQuestion(locals);
        describe('save data for later submission', function() {
            it('should succeed', function() {
                locals.savedVariant = _.clone(locals.variant);
                locals.questionSavedCsrfToken = locals.__csrf_token;
            });
        });
    });

    describe('19. grade incorrect answer to question addVectors', function() {
        describe('setting up the submission data', function() {
            it('should succeed', function() {
                locals.shouldHaveButtons = ['grade', 'save'];
                locals.postAction = 'grade';
                locals.question = addVectors;
                locals.expectedResult = {
                    submission_score: 0,
                    submission_correct: false,
                    instance_question_points: 0,
                    instance_question_score_perc: 0/11 * 100,
                    assessment_instance_points: 3,
                    assessment_instance_score_perc: 3/33 * 100,
                };
                locals.getSubmittedAnswer = function(_variant) {
                    return {
                        wx: 2000,
                        wy: -3000,
                    };
                };
            });
        });
        helperQuestion.getInstanceQuestion(locals);
        helperQuestion.postInstanceQuestion(locals);
    });

    describe('22. submit correct answer to saved question addVectors page', function() {
        describe('setting up the submission data', function() {
            it('should succeed', function() {
                locals.question = addVectors;
                locals.postAction = 'save';
                locals.getSubmittedAnswer = function(variant) {
                    return {
                        wx: variant.true_answer.wx,
                        wy: variant.true_answer.wy,
                    };
                };
            });
        });
        describe('restore saved data for submission', function() {
            it('should succeed', function() {
                locals.variant = _.clone(locals.savedVariant);
                locals.__csrf_token = locals.questionSavedCsrfToken;
            });
        });
        helperQuestion.postInstanceQuestionAndFail(locals);
    });

    describe('23. load question fossilFuelsRadio page and save data for later submission', function() {
        describe('setting up the submission data', function() {
            it('should succeed', function() {
                locals.shouldHaveButtons = ['grade', 'save'];
                locals.question = fossilFuelsRadio;
            });
        });
        helperQuestion.getInstanceQuestion(locals);
        describe('save data for later submission', function() {
            it('should succeed', function() {
                locals.savedVariant = _.clone(locals.variant);
                locals.questionSavedCsrfToken = locals.__csrf_token;
            });
        });
    });

    describe('26. close exam', function() {
        it('should succeed', function(callback) {
            sqldb.queryOneRow(sql.close_all_assessment_instances, [], function(err, _result) {
                if (ERR(err, callback)) return;
                callback(null);
            });
        });
    });

    describe('27. save correct answer to saved question fossilFuelsRadio page', function() {
        describe('setting up the submission data', function() {
            it('should succeed', function() {
                locals.question = fossilFuelsRadio;
                locals.postAction = 'save';
                locals.getSubmittedAnswer = function(variant) {
                    return {
                        key: variant.true_answer.key,
                    };
                };
            });
        });
        describe('restore saved data for submission', function() {
            it('should succeed', function() {
                locals.variant = _.clone(locals.savedVariant);
                locals.__csrf_token = locals.questionSavedCsrfToken;
            });
        });
        helperQuestion.postInstanceQuestionAndFail(locals);
    });

    describe('30. regrading', function() {
        describe('set forceMaxPoints = true for question addVectors', function() {
            it('should succeed', function(callback) {
                sqldb.query(sql.update_addVectors_force_max_points, [], function(err, _result) {
                    if (ERR(err, callback)) return;
                    callback(null);
                });
            });
        });
        helperQuestion.regradeAssessment(locals);
        describe('check the regrading succeeded', function() {
            describe('setting up the expected question addNumbers results', function() {
                it('should succeed', function() {
                    locals.question = addNumbers;
                    locals.expectedResult = {
                        submission_score: 1,
                        submission_correct: true,
                        instance_question_points: 3,
                        instance_question_score_perc: 3/5 * 100,
                    };
                });
            });
            helperQuestion.checkQuestionScore(locals);
            describe('setting up the expected question addVectors results', function() {
                it('should succeed', function() {
                    locals.question = addVectors;
                    locals.expectedResult = {
                        submission_score: 0,
                        submission_correct: false,
                        instance_question_points: 11,
                        instance_question_score_perc: 11/11 * 100,
                    };
                });
            });
            helperQuestion.checkQuestionScore(locals);
            describe('setting up the expected question fossilFuelsRadio results', function() {
                it('should succeed', function() {
                    locals.question = fossilFuelsRadio;
                    locals.expectedResult = {
                        submission_score: null,
                        submission_correct: null,
                        instance_question_points: 0,
                        instance_question_score_perc: 0/17 * 100,
                    };
                });
            });
            helperQuestion.checkQuestionScore(locals);
            describe('setting up the expected assessment results', function() {
                it('should succeed', function() {
                    locals.expectedResult = {
                        assessment_instance_points: 14,
                        assessment_instance_score_perc: 14/33 * 100,
                    };
                });
            });
            helperQuestion.checkAssessmentScore(locals);
        });
    });
});
