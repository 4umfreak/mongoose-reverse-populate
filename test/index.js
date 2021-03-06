const { keyBy, idMatch, idsMatch, rando, getSelectString } = require('../lib/populateUtils');
const reversePopulate = require('../index');
const assert = require('assert');
const async = require('async');
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

describe('Connecting mongoose', function() {

	before(() => {
		mongoose.connect('mongodb://localhost/mongoose-rev-pop-test', {
			useNewUrlParser: true
		});		
	});

	after(() => {
		mongoose.disconnect();		
	});


	describe('multiple results', function() {
		let Category, Post, Author;
		let categories, posts, authors;

		//define schemas and models for tests
		before(function(done) {
			//a category has many posts
			const categorySchema = new Schema({
				name: String,
			});
			Category = mongoose.model('Category', categorySchema);

			//a post can have many categories
			//a post can ONLY have one author
			const postSchema = new Schema({
				title: String,
				categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
				author: { type: Schema.Types.ObjectId, ref: 'Author' },
				content: String
			});
			Post = mongoose.model('Post', postSchema);

			//an author has many posts
			const authorSchema = new Schema({
				firstName: String,
				lastName: String
			});
			Author = mongoose.model('Author', authorSchema);
			done();
		});

		//create 2 x categories, 1 x author and 10 x posts
		beforeEach(function(done) {
			Category.create({
				name: rando()
			}, function(err, category) {
				assert.deepEqual(err, null);
				categories = [];
				categories.push(category);

				Category.create({
					name: rando()
				}, function(err, category) {
					assert.deepEqual(err, null);
					categories.push(category);

					Author.create({
						firstName: rando(),
						lastName: rando(),
					}, function(err, author) {
						assert.deepEqual(err, null);
						authors = [];
						authors.push(author);

						//create multi category posts
						posts = [];
						for (i = 0; i < 5; i++) {
							newPost = new Post({
								title: rando(),
								categories: categories,
								author: author,
								content: rando()
							});
							posts.push(newPost);
						}
						
						//save all posts
						async.each(posts, function(post, cb) {
							post.save(cb);
						}, function(err, result) {
							done();
						});

					});
				});

			});
		});
		
		afterEach(function(done) {
			async.parallel([
				function(cb) { Category.deleteMany({}, cb); },
				function(cb) { Post.deleteMany({}, cb); },
				function(cb) { Author.deleteMany({}, cb); }
			], done);
		});

		const required = ["modelArray", "storeWhere", "arrayPop", "mongooseModel", "idField"];
		required.forEach(function(fieldName) {
			it('check mandatory field ' + fieldName, function(done) {
				const opts = {
					modelArray: categories,
					storeWhere: "posts",
					arrayPop: true,
					mongooseModel: Post,
					idField: "categories"
				};
				delete opts[fieldName];

				reversePopulate(opts, function(err) {
					assert.notDeepEqual(err, null);
					assert.equal(err.message, `Missing mandatory field '${fieldName}'.`);
					done();
				});
			});
		});

		it('should emulate lodash keyBy', (done) => {
			const items = [
				{ name: 'foo', input: 'bar' },
				{ name: 'baz', input: 'zle' }
			];
			const result = keyBy(items, 'name', 'input');
			const expectedResult = {
				foo: { name: 'foo', input: 'bar' },
				baz: { name: 'baz', input: 'zle' }
			};
			assert.deepEqual(result, expectedResult);
			done();
		});

		it('should getSelectString with no change', (done) => {
			const fieldNames = 'foo bar baz';
			const requiredId = 'bar';
			const result = getSelectString(fieldNames, requiredId);
			assert.equal(result, fieldNames);
			done();
		});

		it('should getSelectString with addition', (done) => {
			const fieldNames = 'foo bar baz';
			const requiredId = 'fez';
			const result = getSelectString(fieldNames, requiredId);
			assert.equal(result, 'foo bar baz fez');
			done();
		});

		it('should short circuit on empty modelArray', function(done) {
			const opts = {
				modelArray: [],
				storeWhere: "posts",
				arrayPop: true,
				mongooseModel: Post,
				idField: "categories"
			};
			reversePopulate(opts, function(err, catResult) {
				assert.equal(catResult.length, 0);
				done();
			});
		});

		it('should error on a bad query', function(done) {
			const opts = {
				filters: {$ne: 'not valid'}, // This is invalid and will blow up the query!
				modelArray: categories,
				storeWhere: "posts",
				arrayPop: true,
				mongooseModel: Post,
				idField: "categories"
			};
			reversePopulate(opts, function(err, catResult) {
				assert(err !== null);
				assert(catResult === undefined);
				done();
			});
		});

		//populate categories with their associated posts when the relationship is stored on the post model
		it('should successfully reverse populate a many-to-many relationship', function(done) {
			const opts = {
				modelArray: categories,
				storeWhere: "posts",
				arrayPop: true,
				mongooseModel: Post,
				idField: "categories"
			};
			reversePopulate(opts, function(err, catResult) {
				//expect catResult and categories to be the same
				assert.equal(catResult.length, 2);
				idsMatch(catResult, categories);

				//expect each catResult to contain the posts
				catResult.forEach(function(category) {
					assert.equal(category.posts.length, 5);
					idsMatch(category.posts, posts);
					assert(category.posts[0]._doc !== undefined);
				});
				done();
			});
		});

		//populate categories with their associated posts when the relationship is stored on the post model
		it('should successfully reverse populate a many-to-many relationship with lean objects', function(done) {
			const opts = {
				modelArray: categories,
				storeWhere: "posts",
				arrayPop: true,
				lean: true,
				mongooseModel: Post,
				idField: "categories"
			};
			reversePopulate(opts, function(err, catResult) {
				//expect catResult and categories to be the same
				assert.equal(catResult.length, 2);
				idsMatch(catResult, categories);

				//expect each catResult to contain the posts
				catResult.forEach(function(category) {
					assert.equal(category.posts.length, 5);
					idsMatch(category.posts, posts);
					assert(category.posts[0]._doc === undefined);
				});
				done();
			});
		});

		//populate authors with their associated posts when the relationship is stored on the post model
		it('should successfully reverse populate a one-to-many relationship', function(done) {
			const opts = {
				modelArray: authors,
				storeWhere: "posts",
				arrayPop: true,
				mongooseModel: Post,
				idField: "author"
			};
			reversePopulate(opts, function(err, authResult) {
				//expect catResult and categories to be the same
				assert.equal(authResult.length, 1);
				idsMatch(authResult, authors);

				//expect each catResult to contain the posts
				authResult.forEach(function(author) {
					idsMatch(author.posts, posts);
					assert.equal(author.posts.length, 5);
				});
				done();
			});
		});

		//test to ensure filtering results works as expected
		it('should \"filter\" the query results', function(done) {
			//pick a random post to be filtered (the first one)
			const firstPost = posts[0];

			const opts = {
				modelArray: authors,
				storeWhere: "posts",
				arrayPop: true,
				mongooseModel: Post,
				idField: "author",
				filters: {title: {$ne: firstPost.title}}
			};
			reversePopulate(opts, function(err, authResult) {
				assert.equal(authResult.length, 1);
				const author = authResult[0];

				//the authors posts should exclude the title passed as a filter
				//there are 10 posts for this author and 1 title is excluded so expect 9
				assert.equal(author.posts.length, 4);
				author.posts.forEach(function(post) {
					assert.notEqual(firstPost.title, post.title);
				});

				done();
			});
		});

		it('should \"select\" only the desired fields', function(done) {
			const opts = {
				modelArray: authors,
				storeWhere: "posts",
				arrayPop: true,
				mongooseModel: Post,
				idField: "author",
				select: "title"
			};
			reversePopulate(opts, function(err, authResult) {
				assert.equal(authResult.length, 1);
				const author = authResult[0];

				assert.equal(author.posts.length, 5);
				author.posts.forEach(function(post) {
					//expect these two to be populated
					//author is automatically included as it's required to perform the populate
					assert.notEqual(typeof post.author, "undefined");
					assert.notEqual(typeof post.title, "undefined");
					//expect this to be undefined
					assert.equal(typeof post.catgegory, "undefined");
				});

				done();
			});
		});

		it('should \"sort\" the results returned', function(done) {
			const sortedTitles = posts.map(post => post.title).sort();
			const opts = {
				modelArray: authors,
				storeWhere: "posts",
				arrayPop: true,
				mongooseModel: Post,
				idField: "author",
				sort: "title"
			};
			reversePopulate(opts, function(err, authResult) {
				assert.equal(authResult.length, 1);
				const author = authResult[0];

				assert.equal(author.posts.length, 5);
				const postTitles = author.posts.map(post => post.title);
				assert.deepEqual(sortedTitles, postTitles);

				done();
			});
		});

		//use reverse populate to populate posts within author
		//use standard populate to nest categories in posts
		it('should \"populate\" the results returned', function(done) {
			const opts = {
				modelArray: authors,
				storeWhere: "posts",
				arrayPop: true,
				mongooseModel: Post,
				idField: "author",
				populate: "categories"
			};
			reversePopulate(opts, function(err, authResult) {
				assert.equal(authResult.length, 1);
				idsMatch(authResult, authors);

				const author = authResult[0];
				author.posts.forEach(function(post) {
					assert.equal(post.categories.length, 2);
					idsMatch(post.categories, categories);
				});
				done();
			});
		});
	});

	describe('singular results', function() {
		let Person, Passport;
		let person1, person2, passport1, passport2;

		//define schemas and models for tests
		before(function(done) {
			//a person has one passport
			const personSchema = new Schema({
				firstName: String,
				lastName: String,
				dob: Date
			});
			Person = mongoose.model('Person', personSchema);

			//a passport has one owner (person)
			const passportSchema = new Schema({
				number: String,
				expiry: Date,
				owner: { type: Schema.Types.ObjectId, ref: 'Person' }
			});
			Passport = mongoose.model('Passport', passportSchema);
			done();
		});

		//create 2 x people, 2 x passports
		beforeEach(function(done) {
			Person.create({
				firstName: rando(),
				lastName: rando(),
				dob: new Date(1984, 6, 27)
			}, function (err, person) {
				person1 = person;

				Passport.create({
					number: rando(),
					expiry: new Date(2017, 1, 1),
					owner: person
				}, function(err, passport) {
					passport1 = passport;

					Person.create({
						firstName: rando(),
						lastName: rando(),
						dob: new Date(1984, 6, 27)
					}, function (err, person) {
						person2 = person;

						Passport.create({
							number: rando(),
							expiry: new Date(2017, 1, 1),
							owner: person
						}, function(err, passport) {
							passport2 = passport;
							done();
						});
					});
				});
			});
		});

		afterEach(function(done) {
			async.parallel([
				function(cb) { Person.deleteMany({}, cb); },
				function(cb) { Passport.deleteMany({}, cb); },
			], done);
		});

		it('should successfully reverse populate a one-to-one relationship', function(done) {
			Person.find().exec(function(err, persons) {
				const opts = {
					modelArray: persons,
					storeWhere: "passport",
					arrayPop: false,
					mongooseModel: Passport,
					idField: "owner"
				};
				//as this is one-to-one result should not be populated inside an array
				reversePopulate(opts, function(err, personsResult) {
					personsResult.forEach(function(person) {
						if (person._id.equals(person1._id)) {
							//if this is person1, check against passport1
							idMatch(person.passport, passport1);
						} else {
							//if this is person2, check against passport2
							idMatch(person.passport, passport2);
						}
					});
					done();
				});
			});
		});
	});
});

