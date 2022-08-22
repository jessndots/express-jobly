"use strict";

const db = require("../db.js");
const { BadRequestError, NotFoundError } = require("../expressError");
const Job = require("./job.js");
const {
  commonBeforeAll,
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll,
} = require("./_testCommon");

beforeAll(commonBeforeAll);
beforeEach(commonBeforeEach);
afterEach(commonAfterEach);
afterAll(commonAfterAll);

/************************************** create */

describe("create", function () {
  const newjob = {
    title: "New Job",
    salary: 60000,
    equity: "0.1",
    companyHandle: "c1",
  };

  test("works", async function () {
    let job = await Job.create(newjob);

    const result = await db.query(
          `SELECT id, title, salary, equity, company_handle
           FROM jobs
           WHERE id = $1`, [job.id]);
    expect(result.rows).toEqual([
      {
        id: job.id,
        title: "New Job",
        salary: 60000,
        equity: "0.1",
        company_handle: "c1",
      },
    ]);
  });

  test("bad request with dupe", async function () {
    try {
      await Job.create(newjob);
      await Job.create(newjob);
      fail();
    } catch (err) {
      expect(err instanceof BadRequestError).toBeTruthy();
    }
  });
});

/************************************** findAll */

describe("findAll", function () {
  test("works: no filter", async function () {
    let jobs = await Job.findAll();
    expect(jobs).toEqual([
      {
        title: "j1",
        salary: 100000,
        equity: "0",
        companyHandle: "c1",
      },
      {
        title: "j2",
        salary: 200000,
        equity: "0.02",
        companyHandle: "c2",
      },
      {
        title: "j3",
        salary: 300000,
        equity: "0.03",
        companyHandle: "c3",
      },
    ]);
  });
  test("works: minSalary filter", async function() {
    let jobs = await Job.findAll(null, 200000, null);
    expect(jobs).toEqual([
      {
        title: "j2",
        salary: 200000,
        equity: "0.02",
        companyHandle: "c2",
      },
      {
        title: "j3",
        salary: 300000,
        equity: "0.03",
        companyHandle: "c3",
      }
    ]);
  })
  test("works: hasEquity filter", async function() {
    let jobs = await Job.findAll(null, null, true);
    expect(jobs).toEqual([
      {
        title: "j2",
        salary: 200000,
        equity: "0.02",
        companyHandle: "c2",
      },
      {
        title: "j3",
        salary: 300000,
        equity: "0.03",
        companyHandle: "c3",
      },
    ]);
  })
  test("works: titleLike filter", async function() {
    let jobs = await Job.findAll("1", null, null);
    expect(jobs).toEqual([
      {
        title: "j1",
        salary: 100000,
        equity: "0",
        companyHandle: "c1",
      },
    ]);
  })
  test("works: all filters", async function() {
    let jobs = await Job.findAll("j", 250000, true);
    expect(jobs).toEqual([
      {
        title: "j3",
        salary: 300000,
        equity: "0.03",
        companyHandle: "c3",
      },
    ]);
  })
});

/************************************** get */

describe("get", function () {
  test("works", async function () {
    const res = await db.query(`SELECT id FROM jobs`);
    const id = res.rows[0].id;
    let job = await Job.get(id);
    expect(job).toEqual({
      id: id,
      title: "j1",
      salary: 100000,
      equity: "0",
      company: {
        handle: "c1", 
        name: "C1", 
        description: "Desc1",
        num_employees: 1,
        logo_url: "http://c1.img"
      },
    });
  });

  test("not found if no such job", async function () {
    try {
      await Job.get(420);
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });
});

/************************************** update */

describe("update", function () {
  const updateData = {
    title: "New",
    salary: 999999,
    equity: "0.05",
  };

  test("works", async function () {
    const res = await db.query(`SELECT id FROM jobs`);
    const id = res.rows[0].id;
    let job = await Job.update(id, updateData);
    expect(job).toEqual({
      id: id,
      companyHandle: "c1",
      ...updateData,
    });

    const result = await db.query(
          `SELECT id, title, salary, equity, company_handle
           FROM jobs
           WHERE id = $1`, [job.id]);
    expect(result.rows).toEqual([{
      id: job.id,
      title: "New",
      salary: 999999,
      equity: "0.05",
      company_handle: "c1",
    }]);
  });

  test("works: null fields", async function () {
    const res = await db.query(`SELECT id FROM jobs`);
    const id = res.rows[0].id;
    const updateDataSetNulls = {
      title: "New",
      salary: null,
      equity: null, 
    };

    let job = await Job.update(id, updateDataSetNulls);
    expect(job).toEqual({
      id: id,
      companyHandle: "c1",
      ...updateDataSetNulls,
    });

    const result = await db.query(
          `SELECT id, title, salary, equity, company_handle
           FROM jobs
           WHERE id = $1`, [id]);
    expect(result.rows).toEqual([{
      id: id,
      title: "New",
      salary: null,
      equity: null,
      company_handle: "c1",
    }]);
  });

  test("not found if no such job", async function () {
    try {
      await Job.update(69, updateData);
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });

  test("bad request with no data", async function () {
    try {
      const res = await db.query(`SELECT id FROM jobs`);
      const id = res.rows[0].id;
      await Job.update(id, {});
      fail();
    } catch (err) {
      expect(err instanceof BadRequestError).toBeTruthy();
    }
  });

  test("bad request if attempting to update id or companyHandle", async function () {
    try {
      const res = await db.query(`SELECT id FROM jobs`);
      const id = res.rows[0].id;
      await Job.update(id, {id: 2});
      fail();
    } catch (err) {
      expect(err instanceof BadRequestError).toBeTruthy();
    }
  });
});

/************************************** remove */

describe("remove", function () {
  test("works", async function () {
    const resp = await db.query(`SELECT id FROM jobs`);
    const id = resp.rows[0].id;
    await Job.remove(id);
    const res = await db.query(
        "SELECT id FROM jobs WHERE id=$1", [id]);
    expect(res.rows.length).toEqual(0);
  });

  test("not found if no such job", async function () {
    try {
      await Job.remove(69);
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });
});
