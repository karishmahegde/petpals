const matchQuizService = require("../../services/adopter/matchQuiz.service");
const { successResponse } = require("../../utils/response");

// ——————————————— GET /match-quiz/questions ———————————————
const getQuestions = (req, res) =>
  successResponse(res, "Quiz questions retrieved successfully", matchQuizService.getQuestions());

// ——————————————— GET /adopters/me/quiz ———————————————
const getMyQuiz = async (req, res, next) => {
  try {
    const quiz = await matchQuizService.getMyQuiz(req.user.userID);
    return successResponse(
      res,
      quiz ? "Quiz answers retrieved successfully" : "Quiz not taken yet",
      quiz,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PUT /adopters/me/quiz ———————————————
// Body { answers: { aloneTime: "rarely", … } } — the whole answer set.
const saveMyQuiz = async (req, res, next) => {
  try {
    const answers = matchQuizService.parseQuizAnswers(req.body?.answers);
    const quiz = await matchQuizService.saveMyQuiz(req.user.userID, answers);
    return successResponse(res, "Quiz answers saved successfully", quiz);
  } catch (err) {
    return next(err);
  }
};

module.exports = { getQuestions, getMyQuiz, saveMyQuiz };
