const { sqlForPartialUpdate } = require("./sql");
const { BadRequestError } = require("../expressError");

describe("Changes js format to sql", function(){
    test("works", function () {
        const dataToUpdate = {numEmployees: 5, description: "Description 3"};
        const jsToSql = {numEmployees: "num_employees", description: "description"};
        const result = sqlForPartialUpdate(dataToUpdate, jsToSql);
        expect(result).toEqual({
          setCols: "\"num_employees\"=$1, \"description\"=$2",
          values: [5, "Description 3"]
        });
      });

    test("throws error when passed empty dataToUpdate object", function(){
        try{
            const dataToUpdate = {};
            const jsToSql = {numEmployees: "num_employees", description: "description"};
            const result = sqlForPartialUpdate(dataToUpdate, jsToSql);
        }
        catch (err){
            expect(err instanceof BadRequestError).toBeTruthy();
        }
    })
    test("throws error when passed empty jsToSql object", function(){
        try{
            const dataToUpdate = {numEmployees: 5, description: "Description 3"};
            const jsToSql = {};
            const result = sqlForPartialUpdate(dataToUpdate, jsToSql);
        }
        catch (err){
            expect(err instanceof BadRequestError).toBeTruthy();
        }
    })
})

