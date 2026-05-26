import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { UserModel } from '../models/User';
import { JobRoleModel } from '../models/JobRole';
import { formatPublicProfile } from '../utils/profileFormat';
import { parseIdStringArray, parseTargetJobRoleId } from '../utils/jsonArrayFields';
import { validateRoadmapCourseIds, ROADMAP_MAX_COURSES } from '../utils/roadmapCourses';

async function loadRoadmapUser(userId: number) {
  return UserModel.findById(userId);
}

/** GET /api/auth/career-roadmap */
export const getCareerRoadmap = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user;
    if (!authUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const user = await loadRoadmapUser(authUser.userId);
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    const targetJobRoleId = parseTargetJobRoleId(user.target_job_role_id);
    let jobRole = null;
    if (targetJobRoleId != null) {
      jobRole = await JobRoleModel.findById(targetJobRoleId);
    }

    sendSuccess(
      res,
      {
        target_job_role_id: targetJobRoleId ?? user.target_job_role_id ?? null,
        roadmap_course_ids: parseIdStringArray(user.roadmap_course_ids),
        completed_course_ids: parseIdStringArray(user.completed_course_ids),
        job_role: jobRole,
      },
      'Career roadmap retrieved'
    );
  } catch (err) {
    console.error('getCareerRoadmap error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** PUT /api/auth/career-roadmap/courses */
export const replaceRoadmapCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user;
    if (!authUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const raw = req.body?.course_ids ?? req.body?.roadmap_course_ids;
    if (raw === undefined) {
      sendError(res, 'course_ids is required', 400);
      return;
    }

    const validation = await validateRoadmapCourseIds(authUser.userId, raw);
    if (!validation.ok) {
      sendError(res, validation.message, 400);
      return;
    }

    const updated = await UserModel.update(authUser.userId, {
      roadmap_course_ids: validation.ids,
    });
    if (!updated) {
      sendError(res, 'User not found', 404);
      return;
    }

    sendSuccess(
      res,
      {
        roadmap_course_ids: parseIdStringArray(updated.roadmap_course_ids),
        profile: formatPublicProfile(updated),
      },
      'Roadmap courses updated'
    );
  } catch (err) {
    console.error('replaceRoadmapCourses error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** POST /api/auth/career-roadmap/courses/:courseId */
export const appendRoadmapCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user;
    if (!authUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const courseIdParam = req.params.courseId ?? req.params.id;
    const courseId = parseInt(String(Array.isArray(courseIdParam) ? courseIdParam[0] : courseIdParam), 10);
    if (!Number.isFinite(courseId) || courseId <= 0) {
      sendError(res, 'Invalid course ID', 400);
      return;
    }

    const user = await loadRoadmapUser(authUser.userId);
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    const current = parseIdStringArray(user.roadmap_course_ids);
    const idStr = String(courseId);
    if (current.includes(idStr)) {
      sendSuccess(res, { roadmap_course_ids: current }, 'Course already on roadmap');
      return;
    }
    if (current.length >= ROADMAP_MAX_COURSES) {
      sendError(res, `Roadmap cannot exceed ${ROADMAP_MAX_COURSES} courses`, 400);
      return;
    }

    const validation = await validateRoadmapCourseIds(authUser.userId, [...current, idStr]);
    if (!validation.ok) {
      sendError(res, validation.message, 400);
      return;
    }

    const updated = await UserModel.update(authUser.userId, {
      roadmap_course_ids: validation.ids,
    });
    if (!updated) {
      sendError(res, 'User not found', 404);
      return;
    }

    sendSuccess(
      res,
      { roadmap_course_ids: parseIdStringArray(updated.roadmap_course_ids) },
      'Course added to roadmap'
    );
  } catch (err) {
    console.error('appendRoadmapCourse error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** DELETE /api/auth/career-roadmap/courses/:courseId */
export const removeRoadmapCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user;
    if (!authUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const courseIdParam = req.params.courseId ?? req.params.id;
    const courseId = String(Array.isArray(courseIdParam) ? courseIdParam[0] : courseIdParam);

    const user = await loadRoadmapUser(authUser.userId);
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    const current = parseIdStringArray(user.roadmap_course_ids);
    const next = current.filter((id) => id !== courseId && id !== String(parseInt(courseId, 10)));

    const updated = await UserModel.update(authUser.userId, { roadmap_course_ids: next });
    if (!updated) {
      sendError(res, 'User not found', 404);
      return;
    }

    sendSuccess(
      res,
      { roadmap_course_ids: parseIdStringArray(updated.roadmap_course_ids) },
      'Course removed from roadmap'
    );
  } catch (err) {
    console.error('removeRoadmapCourse error:', err);
    sendError(res, 'Internal server error', 500);
  }
};
