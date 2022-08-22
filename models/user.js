"use strict";

const db = require("../db");
const bcrypt = require("bcrypt");
const { sqlForPartialUpdate } = require("../helpers/sql");
const {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} = require("../expressError");

const { BCRYPT_WORK_FACTOR } = require("../config.js");
const Job = require("./job");

/** Related functions for users. */

class User {
  /** authenticate user with username, password.
   *
   * Returns { username, first_name, last_name, email, is_admin }
   *
   * Throws UnauthorizedError is user not found or wrong password.
   **/

  static async authenticate(username, password) {
    // try to find the user first
    const result = await db.query(
          `SELECT username,
                  password,
                  first_name AS "firstName",
                  last_name AS "lastName",
                  email,
                  is_admin AS "isAdmin"
           FROM users
           WHERE username = $1`,
        [username],
    );
    if (result.rows.length == 0){
      throw new UnauthorizedError(`Could not find user with username: ${username}`)
    }

    const jobsRes = await db.query(`SELECT job_id FROM applications WHERE username = $1`, [username])
    const user = result.rows[0];
    let jobs;
    if (jobsRes.rows.length == 0) {
      jobs = []
    } else {
      jobs = jobsRes.rows.map(r => r.job_id);
    }

    user.jobs = jobs

    if (user) {
      // compare hashed password to a new hash from password
      const isValid = await bcrypt.compare(password, user.password);
      if (isValid === true) {
        delete user.password;
        return user;
      }
    }

    throw new UnauthorizedError("Invalid username/password");
  }

  /** Register user with data.
   *
   * Returns { username, firstName, lastName, email, isAdmin }
   *
   * Throws BadRequestError on duplicates.
   **/

  static async register(
      { username, password, firstName, lastName, email, isAdmin }) {
    const duplicateCheck = await db.query(
          `SELECT username
           FROM users
           WHERE username = $1`,
        [username],
    );

    if (duplicateCheck.rows[0]) {
      throw new BadRequestError(`Duplicate username: ${username}`);
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);

    const result = await db.query(
          `INSERT INTO users
           (username,
            password,
            first_name,
            last_name,
            email,
            is_admin)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING username, first_name AS "firstName", last_name AS "lastName", email, is_admin AS "isAdmin"`,
        [
          username,
          hashedPassword,
          firstName,
          lastName,
          email,
          isAdmin,
        ],
    );

    const user = result.rows[0];

    return user;
  }

  /** Find all users.
   *
   * Returns [{ username, first_name, last_name, email, is_admin }, ...]
   **/

  static async findAll() {
    const result = await db.query(
          `SELECT username,
                  first_name AS "firstName",
                  last_name AS "lastName",
                  email,
                  is_admin AS "isAdmin"
           FROM users
           ORDER BY username`,
    );

    return result.rows;
  }

  /** Given a username, return data about user.
   *
   * Returns { username, first_name, last_name, is_admin, jobs }
   *   where jobs is { id, title, company_handle, company_name, state }
   *
   * Throws NotFoundError if user not found.
   **/

  static async get(username) {
    const userRes = await db.query(
          `SELECT u.username AS "username",
                  u.first_name AS "firstName",
                  u.last_name AS "lastName",
                  u.email AS "email",
                  u.is_admin AS "isAdmin",
                  j.id AS "jobs"
           FROM users AS u
           LEFT JOIN applications AS a
           ON u.username = a.username
           LEFT JOIN jobs AS j
           ON a.job_id = j.id
           WHERE u.username = $1`,
        [username],
    );
    if (userRes.rows.length == 0) {
      throw new NotFoundError(`Could not find user with username of ${username}`)
    }
    const user = userRes.rows[0];
    const jobsRes = await db.query(`SELECT job_id FROM applications WHERE username = $1`, [username])
    
    let jobs;
    if (jobsRes.rows.length == 0) {
      jobs = []
    } else {
      jobs = jobsRes.rows.map(r => r.job_id);
    }

    user.jobs = jobs

    return user;
  }

  /** Update user data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain
   * all the fields; this only changes provided ones.
   *
   * Data can include:
   *   { firstName, lastName, password, email, isAdmin }
   *
   * Returns { username, firstName, lastName, email, isAdmin }
   *
   * Throws NotFoundError if not found.
   *
   * WARNING: this function can set a new password or make a user an admin.
   * Callers of this function must be certain they have validated inputs to this
   * or a serious security risks are opened.
   */

  static async update(username, data) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, BCRYPT_WORK_FACTOR);
    }

    const { setCols, values } = sqlForPartialUpdate(
        data,
        {
          firstName: "first_name",
          lastName: "last_name",
          isAdmin: "is_admin",
        });
    const usernameVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE users 
                      SET ${setCols} 
                      WHERE username = ${usernameVarIdx} 
                      RETURNING username,
                                first_name AS "firstName",
                                last_name AS "lastName",
                                email,
                                is_admin AS "isAdmin"`;
    const result = await db.query(querySql, [...values, username]);
    if (result.rows.length == 0) {
      throw new NotFoundError(`Could not find user with username of ${username}`)
    }
    const jobsRes = await db.query(`SELECT job_id FROM applications WHERE username = $1`, [username])
    const user = result.rows[0];

    let jobs;
    if (jobsRes.rows.length == 0) {
      jobs = []
    } else {
      jobs = jobsRes.rows.map(r => r.job_id);
    }

    user.jobs = jobs

    delete user.password;
    return user;
  }

  /** Delete given user from database; returns undefined. */

  static async remove(username) {
    let result = await db.query(
          `DELETE
           FROM users
           WHERE username = $1
           RETURNING username`,
        [username],
    );
    const user = result.rows[0];

    if (!user) throw new NotFoundError(`No user: ${username}`);
  }


  /** User applies to job with given id; returns undefined */
  static async apply(username, jobId) {
    const userCheck = await db.query(
      `SELECT username FROM users WHERE username=$1`, [username])
    if (userCheck.rows.length == 0) {
      throw new NotFoundError(`Could not find user with username: ${username}`)
    }
    const jobCheck = await db.query(
      `SELECT title FROM jobs WHERE id=$1`, [jobId])
    if (jobCheck.rows.length == 0) {
      throw new NotFoundError(`Could not find job with id: ${jobId}`)
    }


    const result = await db.query(
      `INSERT INTO applications (username, job_id)
      VALUES ($1, $2)
      RETURNING username, job_id`, [username, jobId] 
    )
    if (result.rows.length > 0){
      return undefined
    } 
  }
}


module.exports = User;
