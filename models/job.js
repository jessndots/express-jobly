"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

/** Related functions for jobs. */

class Job {
  /** Create a job (from data), update db, return new job data.
   *
   * data should be { title, salary, equity, company_handle }
   *
   * Returns { title, salary, equity, company_handle }
   *
   * Throws BadRequestError if job already in database.
   * */

  static async create({ title, salary, equity, companyHandle }) {
    const duplicateCheck = await db.query(
          `SELECT title
           FROM jobs
           WHERE company_handle = $1
           AND title = $2`,
        [companyHandle, title]);

    if (duplicateCheck.rows[0])
      throw new BadRequestError(`Duplicate job: ${companyHandle}, ${title}`);

    const result = await db.query(
          `INSERT INTO jobs
           (title, salary, equity, company_handle)
           VALUES ($1, $2, $3, $4)
           RETURNING id, title, salary, equity, company_handle AS "companyHandle"`,
        [title, salary, equity, companyHandle],
    );
    const job = result.rows[0];

    return job;
  }

  /** Find all jobs.
   * Filters by title, minSalary, and hasEquity (if provided)
   * Returns [{ title, salary, equity, company_handle }, ...]
   * */

  static async findAll(title=null, minSalary=null, hasEquity=null) {
    let filters = [];
    let values = [];
    let idx = 1;
    if (title) {
      filters.push(`LOWER(title) LIKE $${idx}`);
      values.push(`%${title}%`)
      idx += 1;
    }
    if (minSalary) {
      filters.push(`salary >= $${idx}`);
      values.push(minSalary);
      idx += 1;
    }
    if (hasEquity) {
      filters.push(`equity !=  $${idx}`);
      values.push(`0`);
      idx += 1;
    }
    let jobsRes;
    if (filters.length > 0){
      jobsRes = await db.query(
        `SELECT title,
                salary,
                equity,
                company_handle AS "companyHandle"
        FROM jobs
        WHERE (${filters.join(" AND ")})
        ORDER BY title`,
        values
      )
    } else {
      jobsRes = await db.query(
        `SELECT title,
                salary,
                equity,
                company_handle AS "companyHandle"
         FROM jobs
         ORDER BY title`);
      console.log(jobsRes)
    }
    return jobsRes.rows;
  }

  /** Given a job id, return data about job.
   *
   * Returns { id, title, salary, equity, company }
   *   where company is [{ handle, name, description, numEmployees, logoUrl }, ...]
   *
   * Throws NotFoundError if not found.
   **/

  static async get(id) {

    const jobRes = await db.query(
          `SELECT id,
                  title,
                  salary,
                  equity,
                  company_handle AS company
           FROM jobs
           WHERE id = $1`,
           [id])

    const job = jobRes.rows[0];

    if (!job) throw new NotFoundError(`No job with id of ${id}`);

    const companyRes = await db.query(
          `SELECT handle, 
                  name, 
                  description, 
                  num_employees,
                  logo_url
          FROM companies 
          WHERE handle = $1`, 
          [job.company]
    )

    job.company = companyRes.rows[0];

    return job;
  }

  /** Update job data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain all the
   * fields; this only changes provided ones.
   *
   * Data can include: {title, salary, equity, companyHandle}
   *
   * Returns {id, title, salary, equity, companyHandle}
   *
   * Throws NotFoundError if not found.
   */

  static async update(id, data) {
    if (!data) {
      throw new BadRequestError("Data is required")
    }
    if (data.id || data.companyHandle) {
      throw new BadRequestError("Job id and companyHandle can not be changed")
    }
    const { setCols, values } = sqlForPartialUpdate(
        data,
        {
          companyHandle: "company_handle",
        });
    const idVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE jobs 
                      SET ${setCols} 
                      WHERE id = ${idVarIdx} 
                      RETURNING id,
                                title,
                                salary,
                                equity,
                                company_handle AS "companyHandle"`;

    const result = await db.query(querySql, [...values, id]);
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No job with id of ${id}`);

    return job;
  }

  /** Delete given job from database; returns undefined.
   *
   * Throws NotFoundError if job not found.
   **/

  static async remove(id) {
    const result = await db.query(
          `DELETE
           FROM jobs
           WHERE id = $1
           RETURNING id`,
        [id]);
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No job: ${id}`);
  }
}


module.exports = Job;
